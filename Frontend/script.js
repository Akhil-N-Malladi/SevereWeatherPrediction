(function () {
  let countyValues = new Map();
  let svg;
  let activeInterpolator = null;
  let countyProfiles = new Map();

  const hazardPalettes = {
    "Extreme Heat": {
      low: "#fff1bf",
      high: "#b21b2c",
      button: "#b21b2c",
      label: "Extreme heat risk",
    },
    "Extreme Cold": {
      low: "#d9ecf7",
      high: "#174a7c",
      button: "#245a8d",
      label: "Extreme cold risk",
    },
    "Extreme Wind": {
      low: "#d8eee9",
      high: "#205c57",
      button: "#205c57",
      label: "Extreme wind risk",
    },
    Hail: {
      low: "#e5f0d5",
      high: "#4f7f42",
      button: "#4f7f42",
      label: "Hail risk",
    },
    Snowstorms: {
      low: "#e4e7f7",
      high: "#5867a9",
      button: "#5867a9",
      label: "Snowstorm risk",
    },
    "Heavy Rain": {
      low: "#e5dfec",
      high: "#5b4a77",
      button: "#5b4a77",
      label: "Heavy rain risk",
    },
  };

  const stateClimateProfiles = {
    hotDry: new Set(["04", "06", "32", "35", "49"]), // AZ, CA, NV, NM, UT
    hotHumid: new Set(["01", "05", "12", "13", "22", "28", "37", "45", "47", "48"]),
    coldNorth: new Set(["23", "26", "27", "30", "33", "36", "38", "46", "50", "55", "56"]),
    mountainWest: new Set(["08", "16", "30", "32", "35", "49", "56"]),
    greatPlains: new Set(["20", "31", "38", "40", "46", "48"]),
    pacificNorthwest: new Set(["41", "53"]),
    gulfCoast: new Set(["01", "12", "22", "28", "48"]),
    atlanticCoast: new Set(["10", "11", "12", "13", "24", "25", "34", "36", "37", "45", "51"]),
  };

  function clamp(value, min = 3, max = 97) {
    return Math.max(min, Math.min(max, value));
  }

  function deterministicNoise(id, hazard, spread = 14) {
    const input = `${id}-${hazard}`;
    let hash = 0;

    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) % 9973;
    }

    return ((hash / 9972) - 0.5) * spread;
  }

  function countyPatchNoise(profile, hazard) {
    const { id, lat, lon } = profile;

    let hash = 0;
    const input = `${id}-${hazard}-patch`;

    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 37 + input.charCodeAt(i)) % 7919;
    }

    const randomJitter = ((hash / 7918) - 0.5) * 22;

    const wavePatch =
      Math.sin(lat * 1.7 + lon * 0.9 + hazard.length) * 7 +
      Math.cos(lat * 0.8 - lon * 1.4 + hazard.length * 2) * 5;

    return randomJitter + wavePatch;
  }

  function buildCountyProfile(county) {
    const id = String(county.id).padStart(5, "0");
    const state = id.slice(0, 2);
    const [lon, lat] = d3.geoCentroid(county);

    return {
      id,
      state,
      lon,
      lat,
      southness: clamp((39 - lat) * 3.2, 0, 42),
      northness: clamp((lat - 36) * 3.4, 0, 42),
      westness: clamp((-94 - lon) * 1.05, 0, 40),
      eastness: clamp((lon + 98) * 0.9, 0, 35),
    };
  }

  function contextualCountyValue(id, hazard) {
    const profile = countyProfiles.get(String(id).padStart(5, "0"));

    if (!profile) {
      return clamp(45 + deterministicNoise(id, hazard, 18));
    }

    const { state, southness, northness, westness, eastness, lat, lon } = profile;

    const isHotDry = stateClimateProfiles.hotDry.has(state);
    const isHotHumid = stateClimateProfiles.hotHumid.has(state);
    const isColdNorth = stateClimateProfiles.coldNorth.has(state);
    const isMountainWest = stateClimateProfiles.mountainWest.has(state);
    const isGreatPlains = stateClimateProfiles.greatPlains.has(state);
    const isPNW = stateClimateProfiles.pacificNorthwest.has(state);
    const isGulf = stateClimateProfiles.gulfCoast.has(state);
    const isAtlantic = stateClimateProfiles.atlanticCoast.has(state);

    let score = 30;

    if (hazard === "Extreme Heat") {
      score =
        18 +
        southness +
        (isHotDry ? 30 : 0) +
        (isHotHumid ? 20 : 0) +
        (westness > 15 && lat < 39 ? 10 : 0) -
        northness * 0.35;
    } else if (hazard === "Extreme Cold") {
      score =
        14 +
        northness +
        (isColdNorth ? 30 : 0) +
        (isMountainWest ? 14 : 0) -
        (isHotDry ? 18 : 0) -
        southness * 0.25;
    } else if (hazard === "Extreme Wind") {
      score =
        22 +
        (isGreatPlains ? 28 : 0) +
        (isMountainWest ? 12 : 0) +
        (isAtlantic || isGulf ? 12 : 0) +
        clamp(Math.abs(lon + 98) * -0.5 + 14, 0, 14);
    } else if (hazard === "Hail") {
      score =
        15 +
        (isGreatPlains ? 38 : 0) +
        (state === "48" || state === "40" || state === "20" ? 12 : 0) +
        clamp(38 - Math.abs(lat - 36) * 3, 0, 18) -
        (isPNW ? 12 : 0);
    } else if (hazard === "Snowstorms") {
      score =
        10 +
        northness +
        (isColdNorth ? 32 : 0) +
        (isMountainWest ? 22 : 0) +
        (isPNW && lat > 44 ? 10 : 0) -
        southness * 0.45;
    } else if (hazard === "Heavy Rain") {
      score =
        20 +
        (isGulf ? 30 : 0) +
        (isAtlantic ? 16 : 0) +
        (isPNW ? 22 : 0) +
        eastness * 0.25 +
        (state === "22" || state === "12" ? 12 : 0) -
        (isHotDry ? 18 : 0);
    }

    const patchiness = countyPatchNoise(profile, hazard);
    const smallNoise = deterministicNoise(id, hazard, 10);

    return Math.round(clamp(score + patchiness + smallNoise));
  }

  function seedCountyValues(hazard) {
    countyValues = new Map(
      Array.from(countyProfiles.keys()).map((id) => [id, contextualCountyValue(id, hazard)])
    );
  }

  function setControlColor(color) {
    const refreshButton = document.getElementById("refresh");
    const dropdown = document.getElementById("dropdown");

    if (refreshButton) refreshButton.style.backgroundColor = color;
    if (dropdown) dropdown.style.borderColor = color;
  }

  const mapEl = document.getElementById("map");

  if (mapEl && window.d3 && window.topojson) {
    const width = Math.max(mapEl.clientWidth || 960, 760);
    const height = 610;

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("id", "tooltip")
      .style("position", "absolute")
      .style("padding", "10px 12px")
      .style("background", "#071d33")
      .style("color", "#fff")
      .style("border", "1px solid rgba(255,255,255,0.25)")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("display", "none")
      .style("z-index", "1000");

    svg = d3
      .select("#map")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "County-level severe weather risk map");

    const projection = d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(1180);
    const path = d3.geoPath().projection(projection);
    const topoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

    fetch(topoUrl)
      .then((response) => response.json())
      .then((topology) => {
        const countyData = topojson.feature(topology, topology.objects.counties).features;
        const initialHazard = document.getElementById("dropdown")?.value || "Extreme Heat";

        countyData.forEach((county) => {
          const id = String(county.id).padStart(5, "0");
          countyProfiles.set(id, buildCountyProfile(county));
        });

        seedCountyValues(initialHazard);

        svg
          .append("g")
          .attr("class", "counties")
          .selectAll("path")
          .data(countyData)
          .join("path")
          .attr("d", path)
          .attr("fill", "#f7f4ed")
          .attr("stroke", "rgba(7,29,51,0.22)")
          .attr("stroke-width", 0.35)
          .on("mouseover", function (event, county) {
            d3.select(this).attr("stroke", "#071d33").attr("stroke-width", 1.2);

            const value = countyValues.get(String(county.id).padStart(5, "0")) || 0;
            const label = hazardPalettes[document.getElementById("dropdown")?.value]?.label || "Risk";

            tooltip
              .style("display", "block")
              .html(`County FIPS: ${county.id}<br>${label}: ${value}%`);
          })
          .on("mousemove", function (event) {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY + 12}px`);
          })
          .on("mouseleave", function () {
            d3.select(this).attr("stroke", "rgba(7,29,51,0.22)").attr("stroke-width", 0.35);
            tooltip.style("display", "none");
          });

        svg
          .append("path")
          .datum(topojson.mesh(topology, topology.objects.states, (a, b) => a !== b))
          .attr("d", path)
          .attr("fill", "none")
          .attr("stroke", "#071d33")
          .attr("stroke-width", 0.8)
          .style("pointer-events", "none");

        window.refreshMap();
      })
      .catch(() => {
        mapEl.innerHTML =
          '<div class="map-error">Map data could not be loaded. Please check the connection and refresh.</div>';
      });
  }

  window.refreshMap = function () {
    const dropdown = document.getElementById("dropdown");

    if (!dropdown || !window.d3) return;

    const type = dropdown.value;
    const palette = hazardPalettes[type] || hazardPalettes["Extreme Heat"];

    activeInterpolator = d3.interpolateRgb(palette.low, palette.high);
    seedCountyValues(type);
    setControlColor(palette.button);

    const contrastScale = d3.scalePow().exponent(1.18).domain([0, 100]).range([0, 1]);

    if (svg) {
      svg
        .select(".counties")
        .selectAll("path")
        .transition()
        .duration(700)
        .attr("fill", (county) => {
          const value = countyValues.get(String(county.id).padStart(5, "0")) || 0;
          return activeInterpolator(contrastScale(value));
        });
    }
  };
})();

function getNumericValue(data, keys) {
  for (const key of keys) {
    if (typeof data[key] === "number") {
      return data[key];
    }
  }

  return null;
}

function setResult(id, value) {
  const element = document.getElementById(id);

  if (!element) return;

  element.innerText = typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "Pending";
}

async function fetchData() {
  const lat = document.getElementById("latitude")?.value.trim();
  const lon = document.getElementById("longitude")?.value.trim();
  const getDataButton = document.getElementById("getData");
  const innerBox = document.getElementById("output");

  if (!lat || !lon) {
    alert("Please enter both latitude and longitude.");
    return null;
  }

  const originalText = getDataButton.textContent;

  getDataButton.textContent = "Loading...";
  getDataButton.disabled = true;

  try {
    const response = await fetch(
      `https://severeweatherprediction.onrender.com/predict?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
    );

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    setResult("extreme-heat-chance", getNumericValue(data, ["Extreme Heat Chance", "extreme-heat-chance"]));
    setResult("extreme-cold-chance", getNumericValue(data, ["Extreme Cold Chance", "extreme-cold-chance"]));
    setResult(
      "extreme-wind-chance",
      getNumericValue(data, ["High Speed Wind Chance", "Extreme Wind Chance", "extreme-wind-chance"])
    );
    setResult("hail-chance", getNumericValue(data, ["Hail Chance", "hail-chance"]));
    setResult("snowstorms-chance", getNumericValue(data, ["Snowstorm Chance", "Snowstorms Chance", "snowstorms-chance"]));
    setResult("heavy-rain-chance", getNumericValue(data, ["Heavy Rain Chance", "heavy-rain-chance"]));

    if (innerBox) {
      innerBox.style.borderColor = "#245a8d";
    }

    window.refreshMap();
    return data;
  } catch (error) {
    alert(`Failed to fetch data: ${error.message}`);
    return null;
  } finally {
    getDataButton.textContent = originalText;
    getDataButton.disabled = false;
  }
}

async function getLocation() {
  const lat = document.getElementById("latitude");
  const lon = document.getElementById("longitude");

  if (!navigator.geolocation) {
    alert("Location services are not available in this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      lat.value = position.coords.latitude.toFixed(4);
      lon.value = position.coords.longitude.toFixed(4);
      fetchData();
    },
    () => {
      alert("Location access was not granted. Please enter latitude and longitude manually.");
    }
  );
}
