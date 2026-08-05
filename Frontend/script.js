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
    desertHeat: new Set(["04", "06", "32", "35", "49"]), // AZ, CA, NV, NM, UT
    southernHeat: new Set(["01", "05", "12", "13", "22", "28", "37", "45", "47", "48"]),
    northernCold: new Set(["23", "26", "27", "30", "33", "36", "38", "46", "50", "55", "56"]),
    mountainSnow: new Set(["08", "16", "30", "32", "35", "49", "56"]),
    plainsWind: new Set(["20", "31", "38", "40", "46", "48"]),
    hailAlley: new Set(["08", "20", "31", "35", "40", "48"]),
    pacificRain: new Set(["41", "53"]),
    gulfRain: new Set(["01", "12", "22", "28", "48"]),
    atlanticRain: new Set(["10", "11", "12", "13", "24", "25", "34", "36", "37", "45", "51"]),
  };

  function clamp(value, min = 3, max = 97) {
    return Math.max(min, Math.min(max, value));
  }

  function hashNumber(input, modulus = 1000003) {
    let hash = 0;

    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 37 + input.charCodeAt(i)) % modulus;
    }

    return hash;
  }

  function randomBetween(key, min, max) {
    const h = hashNumber(key);
    return min + (h / 1000002) * (max - min);
  }

  function countyRandom(id, hazard, spread = 20) {
    return randomBetween(`${hazard}-${id}-county`, -spread / 2, spread / 2);
  }

  function patchRandom(profile, hazard, spread = 18) {
    const latBand = Math.floor(profile.lat * 2.4);
    const lonBand = Math.floor(profile.lon * 2.4);
    const key = `${hazard}-patch-${latBand}-${lonBand}-${profile.state}`;
    return randomBetween(key, -spread / 2, spread / 2);
  }

  function localClusterRandom(profile, hazard, spread = 14) {
    const latBand = Math.floor(profile.lat * 5.1);
    const lonBand = Math.floor(profile.lon * 5.1);
    const key = `${hazard}-cluster-${latBand}-${lonBand}-${profile.id}`;
    return randomBetween(key, -spread / 2, spread / 2);
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

      farSouth: clamp((37 - lat) * 4.0, 0, 42),
      deepNorth: clamp((lat - 38) * 4.0, 0, 42),
      farWest: clamp((-96 - lon) * 1.05, 0, 38),
      easternMoisture: clamp((lon + 101) * 0.75, 0, 32),
      centralPlains: clamp(25 - Math.abs(lon + 98) * 2.1, 0, 25),
      gulfInfluence: clamp(31 - Math.abs(lat - 29) * 3.2, 0, 31),
      midLatitudeStormZone: clamp(28 - Math.abs(lat - 37) * 3.0, 0, 28),
      northernWinterZone: clamp(30 - Math.abs(lat - 44) * 3.2, 0, 30),
    };
  }

  function contextualCountyValue(id, hazard) {
    const profile = countyProfiles.get(String(id).padStart(5, "0"));

    if (!profile) {
      return Math.round(clamp(45 + countyRandom(id, hazard, 24)));
    }

    const {
      state,
      lat,
      lon,
      farSouth,
      deepNorth,
      farWest,
      easternMoisture,
      centralPlains,
      gulfInfluence,
      midLatitudeStormZone,
      northernWinterZone,
    } = profile;

    const isDesertHeat = stateClimateProfiles.desertHeat.has(state);
    const isSouthernHeat = stateClimateProfiles.southernHeat.has(state);
    const isNorthernCold = stateClimateProfiles.northernCold.has(state);
    const isMountainSnow = stateClimateProfiles.mountainSnow.has(state);
    const isPlainsWind = stateClimateProfiles.plainsWind.has(state);
    const isHailAlley = stateClimateProfiles.hailAlley.has(state);
    const isPacificRain = stateClimateProfiles.pacificRain.has(state);
    const isGulfRain = stateClimateProfiles.gulfRain.has(state);
    const isAtlanticRain = stateClimateProfiles.atlanticRain.has(state);

    let score = 30;

    if (hazard === "Extreme Heat") {
      score =
        16 +
        farSouth * 0.85 +
        farWest * 0.55 +
        (isDesertHeat ? 32 : 0) +
        (isSouthernHeat ? 18 : 0) -
        deepNorth * 0.45;

      score += randomBetween(`heat-hotspot-${state}-${Math.floor(lat)}-${Math.floor(lon)}`, -8, 13);
      score += patchRandom(profile, hazard, 24);
      score += localClusterRandom(profile, hazard, 16);
      score += countyRandom(profile.id, hazard, 18);
    }

    else if (hazard === "Extreme Cold") {
      score =
        12 +
        deepNorth * 1.0 +
        (isNorthernCold ? 34 : 0) +
        (isMountainSnow ? 12 : 0) -
        farSouth * 0.55 -
        (isDesertHeat ? 10 : 0);

      score += randomBetween(`cold-pocket-${state}-${Math.floor(lat * 1.3)}-${Math.floor(lon * 0.7)}`, -10, 16);
      score += patchRandom(profile, hazard, 26);
      score += localClusterRandom(profile, hazard, 18);
      score += countyRandom(profile.id, hazard, 20);
    }

    else if (hazard === "Extreme Wind") {
      score =
        18 +
        centralPlains * 1.25 +
        midLatitudeStormZone * 0.55 +
        (isPlainsWind ? 30 : 0) +
        (isMountainSnow ? 7 : 0) +
        (isGulfRain || isAtlanticRain ? 8 : 0);

      score += randomBetween(`wind-corridor-${Math.floor(lon * 1.1)}-${state}`, -14, 15);
      score += patchRandom(profile, hazard, 32);
      score += localClusterRandom(profile, hazard, 22);
      score += countyRandom(profile.id, hazard, 22);
    }

    else if (hazard === "Hail") {
      score =
        12 +
        centralPlains * 0.85 +
        midLatitudeStormZone * 1.05 +
        (isHailAlley ? 36 : 0) +
        (state === "48" || state === "40" || state === "20" ? 10 : 0) -
        (isPacificRain ? 10 : 0);

      score += randomBetween(`hail-core-${state}-${Math.floor(lat * 0.8)}-${Math.floor(lon * 1.6)}`, -16, 18);
      score += patchRandom(profile, hazard, 36);
      score += localClusterRandom(profile, hazard, 26);
      score += countyRandom(profile.id, hazard, 24);
    }

    else if (hazard === "Snowstorms") {
      score =
        10 +
        northernWinterZone * 0.95 +
        deepNorth * 0.65 +
        (isNorthernCold ? 25 : 0) +
        (isMountainSnow ? 30 : 0) +
        (isPacificRain && lat > 44 ? 12 : 0) -
        farSouth * 0.65;

      score += randomBetween(`snow-band-${Math.floor(lat * 1.5)}-${Math.floor(lon * 0.9)}-${state}`, -13, 17);
      score += patchRandom(profile, hazard, 30);
      score += localClusterRandom(profile, hazard, 21);
      score += countyRandom(profile.id, hazard, 21);
    }

    else if (hazard === "Heavy Rain") {
      score =
        15 +
        easternMoisture * 0.85 +
        gulfInfluence * 0.75 +
        (isGulfRain ? 32 : 0) +
        (isAtlanticRain ? 18 : 0) +
        (isPacificRain ? 24 : 0) -
        (isDesertHeat ? 22 : 0);

      score += randomBetween(`rain-zone-${state}-${Math.floor(lat * 1.7)}-${Math.floor(lon * 1.2)}`, -15, 19);
      score += patchRandom(profile, hazard, 34);
      score += localClusterRandom(profile, hazard, 24);
      score += countyRandom(profile.id, hazard, 24);
    }

    return Math.round(clamp(score));
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

    const contrastScale = d3.scalePow().exponent(1.35).domain([0, 100]).range([0, 1]);

    if (svg) {
      svg
        .select(".counties")
        .selectAll("path")
        .interrupt()
        .transition()
        .duration(180)
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

    setResult(
      "snowstorms-chance",
      getNumericValue(data, ["Snowstorm Chance", "Snowstorms Chance", "snowstorms-chance"])
    );

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
