(function() {
  let countyValues = new Map();
  let svg; 

  //1. MAP & D3.JS INITIALIZATION
  const mapEl = document.getElementById('map');
  if (mapEl) {
    const width = mapEl.clientWidth || 900;
    const height = mapEl.clientHeight || 600;

    const tooltip = d3.select('body').append('div')
      .attr('id', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '8px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', '#fff')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('font-size', '12px')
      .style('display', 'none')
      .style('z-index', '1000');

    svg = d3.select('#map')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background-color', 'transparent');

    const projection = d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(1100);
    const path = d3.geoPath().projection(projection);
    const topoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

    fetch(topoUrl).then(r => r.json()).then(topology => {
      const countyData = topojson.feature(topology, topology.objects.counties).features;

      // Fill the map with initial data
      countyData.forEach(d => {
        const id = String(d.id);
        const v = (id.split('').reduce((s, ch) => s + Number(ch || 0), 0) * 7) % 100;
        countyValues.set(id, v);
      });

      svg.append('g')
        .attr('class', 'counties')
        .selectAll('path')
        .data(countyData)
        .join('path')
        .attr('d', path)
        .attr('fill', '#fdfbd4') 
        .attr('stroke', 'rgba(0,0,0,0.)') 
        .attr('stroke-width', 0.5)
        .on('mouseover', function(event, d) {
          d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1);
          const v = countyValues.get(String(d.id)) || 0;
          tooltip.style('display', 'block').html(`FIPS: ${d.id}<br>Value: ${v}`);
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseleave', function() {
          d3.select(this).attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 0.5);
          tooltip.style('display', 'none');
        });

      svg.append('path')
        .datum(topojson.mesh(topology, topology.objects.states, (a, b) => a !== b))
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.75)
        .style('pointer-events', 'none');
    });
  }

  //2. HEADER ANIMATIONS (Home Page)
  const header = document.getElementById('header');

  header.addEventListener('mouseover', () => {
    header.style.transform = "scale(1.05)";
    header.style.boxShadow = '0 0px 30px #000000';
  });
  header.addEventListener('mouseleave', () => {
    header.style.transform = "scale(1)";
    header.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
  });
  

  //4. REFRESH MAP (Handles Interpolation & Themes)
  window.refreshMap = function() {
    const dropdown = document.getElementById('dropdown');
    if (!dropdown) return;

    const type = dropdown.value;
    const refreshButton = document.getElementById('refresh');
    const headerEl = document.getElementById('header');
    const box = document.getElementById('box');
    const lat = document.getElementById('latitude');
    const lon = document.getElementById('longitude');
    const getDat = document.getElementById('getData');
    const locInput = document.getElementById('loc-input');
    const footer = document.getElementById('footer');

    let interpolator;
    let btnColor;

    // Restore Interpolation Logic
    switch (type) {
      case 'Extreme Heat':
        interpolator = d3.interpolateRgb("#ffeda0", "#bd0026");
        btnColor = "#ff6f91";
        /*if(headerEl) headerEl.style.backgroundColor = "#9a0024";
        if(box) box.style.backgroundColor = "#9a0024";
        if(lat) lat.style.backgroundColor = "#ff6f91";
        if(lon) lon.style.backgroundColor = "#ff6f91";
        if(getDat) getDat.style.backgroundColor = "#ff6f91";
        if(locInput) locInput.style.backgroundColor = "#9a0024";
        if(footer) footer.style.backgroundColor = "#9a0024";*/
        break;
      case 'Extreme Cold':
        interpolator = d3.interpolateRgb("#e0f2fe", "#1e3a8a");
        btnColor = "#6868ff";
        /*if(headerEl) headerEl.style.backgroundColor = "#00039a";
        if(box) box.style.backgroundColor = "#00039a";
        if(lat) lat.style.backgroundColor = "#6868ff";
        if(lon) lon.style.backgroundColor = "#6868ff";
        if(getDat) getDat.style.backgroundColor = "#6868ff";
        if(locInput) locInput.style.backgroundColor = "#00039a";
        if(footer) footer.style.backgroundColor = "#00039a";*/
        break;
      case 'Extreme Wind':
        interpolator = d3.interpolateRgb("#ccfbf1", "#134e4a");
        btnColor = "#134e4a";
        /*if(headerEl) headerEl.style.backgroundColor = "#2b2b2b";
        if(box) box.style.backgroundColor = "#2b2b2b";
        if(lat) lat.style.backgroundColor = "#686868";
        if(lon) lon.style.backgroundColor = "#686868";
        if(getDat) getDat.style.backgroundColor = "#686868";
        if(locInput) locInput.style.backgroundColor = "#2b2b2b";
        if(footer) footer.style.backgroundColor = "#2b2b2b";*/
        break;
      case 'Hail':
        interpolator = d3.interpolateRgb("#dcfce7", "#14532d");
        btnColor = "#14532d";
        /*if(headerEl) headerEl.style.backgroundColor = "#00799d";
        if(box) box.style.backgroundColor = "#00799d";
        if(lat) lat.style.backgroundColor = "#86dbff";
        if(lon) lon.style.backgroundColor = "#86dbff";
        if(getDat) getDat.style.backgroundColor = "#86dbff";
        if(locInput) locInput.style.backgroundColor = "#00799d";
        if(footer) footer.style.backgroundColor = "#00799d";*/
        break;
      case 'Snowstorms':
        interpolator = d3.interpolateRgb("#e0e7ff", "#2e3b81");
        btnColor = "#2e3b81";
        /*if(headerEl) headerEl.style.backgroundColor = "#560097";
        if(box) box.style.backgroundColor = "#560097";
        if(lat) lat.style.backgroundColor = "#c271ff";
        if(lon) lon.style.backgroundColor = "#c271ff";
        if(getDat) getDat.style.backgroundColor = "#c271ff";
        if(locInput) locInput.style.backgroundColor = "#560097";
        if(footer) footer.style.backgroundColor = "#560097";*/
        break;
      case 'Heavy Rain':
        interpolator = d3.interpolateRgb("#f3e8ff", "#441469"); 
        btnColor = "#441469";
        /*if(headerEl) headerEl.style.backgroundColor = "#00549d";
        if(box) box.style.backgroundColor = "#00549d";
        if(lat) lat.style.backgroundColor = "#5bb0ff";
        if(lon) lon.style.backgroundColor = "#5bb0ff";
        if(getDat) getDat.style.backgroundColor = "#5bb0ff";
        if(locInput) locInput.style.backgroundColor = "#00549d";
        if(footer) footer.style.backgroundColor = "#00549d";*/
        break;
      default:
        interpolator = d3.interpolateGreys;
        //btnColor = "#333";
    }

    if(refreshButton) refreshButton.style.backgroundColor = btnColor;
    dropdown.style.backgroundColor = btnColor;

    // Re-run the color transition on the map paths
    const contrastScale = d3.scalePow().exponent(1.2).domain([0, 100]).range([0, 1]);

    if (svg) {
      svg.select('.counties')
        .selectAll('path')
        .transition()
        .duration(1000)
        .attr('fill', d => {
          const v = countyValues.get(String(d.id)) || 0;
          return interpolator(contrastScale(v));
        });
    }
  };

  //Event Box Animations
  const event1 = document.getElementById('event1');
  if (event1) {
    event1.addEventListener('mouseover', () => {
      event1.style.boxShadow = '0 0px 30px #c9ab00';
      event1.style.transform = "scale(1.05)";
      event1.style.backgroundColor = "#c9ab00";
    });
    event1.addEventListener('mouseleave', () => {
      event1.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      event1.style.transform = "scale(1)";
      event1.style.backgroundColor = "";
    });
  }

  const event2 = document.getElementById('event2');
  if (event2) {
    event2.addEventListener('mouseover', () => {
      event2.style.boxShadow = '0 0px 30px #c9ab00';
      event2.style.transform = "scale(1.05)";
      event2.style.backgroundColor = "#c9ab00";
    });
    event2.addEventListener('mouseleave', () => {
      event2.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      event2.style.transform = "scale(1)";
      event2.style.backgroundColor = "";

    });
  }

  const event3 = document.getElementById('event3');
  if (event3) {
    event3.addEventListener('mouseover', () => {
      event3.style.boxShadow = '0 0px 30px #c9ab00';
      event3.style.transform = "scale(1.05)";
      event3.style.backgroundColor = "#c9ab00";
    });
    event3.addEventListener('mouseleave', () => {
      event3.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      event3.style.transform = "scale(1)";
      event3.style.backgroundColor = "";
    });
  }

  const event4 = document.getElementById('event4');
  if (event4) {
    event4.addEventListener('mouseover', () => {
      event4.style.boxShadow = '0 0px 30px #c9ab00';
      event4.style.transform = "scale(1.05)";
      event4.style.backgroundColor = "#c9ab00";
    });
    event4.addEventListener('mouseleave', () => {
      event4.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      event4.style.transform = "scale(1)";
      event4.style.backgroundColor = "";
    });
  }
  

  //Interpretability Page Animations
  const extremeHeatBox = document.getElementById('Extreme-heat-interpretability');
  if(extremeHeatBox) {
    extremeHeatBox.addEventListener('mouseover', () => {
      extremeHeatBox.style.boxShadow = '0 0px 30px #ff6f91';
      extremeHeatBox.style.transform = "scale(1.05)";
      extremeHeatBox.style.backgroundColor = "#ff6f91";
      console.log("Hovering over Extreme Heat box");
    });
    extremeHeatBox.addEventListener('mouseleave', () => {
      extremeHeatBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      extremeHeatBox.style.transform = "scale(1)";
      extremeHeatBox.style.backgroundColor = "";
    });
  }

  const extremeWindBox = document.getElementById('Extreme-wind-interpretability');
  if(extremeWindBox) {
    extremeWindBox.addEventListener('mouseover', () => {
      extremeWindBox.style.boxShadow = '0 0px 30px #686868';
      extremeWindBox.style.transform = "scale(1.05)";
      extremeWindBox.style.backgroundColor = "#686868";
    });
    extremeWindBox.addEventListener('mouseleave', () => {
      extremeWindBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      extremeWindBox.style.transform = "scale(1)";
      extremeWindBox.style.backgroundColor = "";
    });
  }

  const hailBox = document.getElementById('Hail-interpretability');
  if(hailBox) {
    hailBox.addEventListener('mouseover', () => {
      hailBox.style.boxShadow = '0 0px 30px #86dbff';
      hailBox.style.transform = "scale(1.05)";
      hailBox.style.backgroundColor = "#86dbff";
    });
    hailBox.addEventListener('mouseleave', () => {
      hailBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      hailBox.style.transform = "scale(1)";
      hailBox.style.backgroundColor = "";
    });
  }
  
  const snowstormsBox = document.getElementById('Snowstorms-interpretability');
  if(snowstormsBox) {
    snowstormsBox.addEventListener('mouseover', () => {
      snowstormsBox.style.boxShadow = '0 0px 30px #c271ff';
      snowstormsBox.style.transform = "scale(1.05)";
      snowstormsBox.style.backgroundColor = "#c271ff";
    });
    snowstormsBox.addEventListener('mouseleave', () => {
      snowstormsBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      snowstormsBox.style.transform = "scale(1)";
      snowstormsBox.style.backgroundColor = "";
    });
  }

  const heavyRainBox = document.getElementById('Heavy-rain-interpretability');
  if(heavyRainBox) {
    heavyRainBox.addEventListener('mouseover', () => {
      heavyRainBox.style.boxShadow = '0 0px 30px #5bb0ff';
      heavyRainBox.style.transform = "scale(1.05)";
      heavyRainBox.style.backgroundColor = "#5bb0ff";
    });
    heavyRainBox.addEventListener('mouseleave', () => {
      heavyRainBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
      heavyRainBox.style.transform = "scale(1)";
      heavyRainBox.style.backgroundColor = "";
    });
  }

    const extremeColdBox = document.getElementById('Extreme-cold-interpretability');
    if(extremeColdBox) {
      extremeColdBox.addEventListener('mouseover', () => {
        extremeColdBox.style.boxShadow = '0 0px 30px #6868ff';
        extremeColdBox.style.transform = "scale(1.05)";
        extremeColdBox.style.backgroundColor = "#6868ff";
      });
      extremeColdBox.addEventListener('mouseleave', () => {
        extremeColdBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
        extremeColdBox.style.transform = "scale(1)";
        extremeColdBox.style.backgroundColor = "";
      });
    }

    
})();

async function fetchData() {
  const lat = document.getElementById('latitude').value;
  const lon = document.getElementById('longitude').value;
  const getDataButton = document.getElementById('getData');
  const innerBox = document.getElementById('output');
  if(!lat || !lon){
    alert("Please enter both latitude and longitude.");
    return;
  }

  const ogText = getDataButton.textContent;
  getDataButton.textContent = "Loading...";
  getDataButton.disabled = true;

  try {
    const response = await fetch(`https://severeweatherprediction.onrender.com/predict?lat=${lat}&lon=${lon}`);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data =  await response.json();
    if(!('extreme-heat-chance' in data)) {
      document.getElementById('extreme-heat-chance').innerText = "random";
      document.getElementById('extreme-cold-chance').innerText = "bums";
      document.getElementById('extreme-wind-chance').innerText = "used";
      document.getElementById('hail-chance').innerText = "all";
      document.getElementById('snowstorms-chance').innerText = "API";
      document.getElementById('heavy-rain-chance').innerText = "calls";
    } else{
      document.getElementById('extreme-heat-chance').innerText = (data['Extreme Heat Chance'] * 100).toFixed(1) + "%";
      document.getElementById('extreme-cold-chance').innerText = (data['Extreme Cold Chance'] * 100).toFixed(1) + "%";
      document.getElementById('extreme-wind-chance').innerText = (data['High Speed Wind Chance'] * 100).toFixed(1) + "%";
      document.getElementById('hail-chance').innerText = (data['Hail Chance'] * 100).toFixed(1) + "%";
      document.getElementById('snowstorms-chance').innerText = (data['Snowstorm Chance'] * 100).toFixed(1) + "%";
      document.getElementById('heavy-rain-chance').innerText = (data['Heavy Rain Chance'] * 100).toFixed(1) + "%";
    }
    const currentType = document.getElementById('dropdown').value + " Chance";
    const predictionProbability = data[currentType] || 0;

    const displayValue = predictionProbability * 100;
    window.currentPredictionValue = displayValue; 

    // 4. Trigger the visual update
    window.refreshMap();
    return data;
  } catch (error) {
    alert("Failed to fetch data: " + error.message);
  } finally {
    getDataButton.textContent = ogText;
    getDataButton.disabled = false;
    innerBox.style.backgroundColor = "#285eff";
  }
}

async function getLocation() {
  alert("Attempting to get your location. Please allow location access if prompted.");
  const lat = document.getElementById('latitude');
  const lon = document.getElementById('longitude');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      lat.value = position.coords.latitude.toFixed(4);
      lon.value = position.coords.longitude.toFixed(4);
      fetchData();
    }
    );
}
