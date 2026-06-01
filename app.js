// Global App State
let appData = null;
let geoJSONData = null;
let currentDashboard = 1;
let currentYear = 2024;
let currentStateTrend = "estados unidos mexicanos";
// Chart.js instances
let radarChartInstance = null;
let ocupacionBarChartInstance = null;
let desocBarChartInstance = null;
let trendChartInstance = null;
let scatterChartInstance = null;
// Leaflet map instances
let mapIncomeInstance = null;
let mapUnemploymentInstance = null;
let mapIncomeLayer = null;
let mapUnemploymentLayer = null;
// State Name Normalization (mirrors Python data_processor)
function normalizeName(name) {
  if (!name) return "";
  return name.toString()
    .replace(/_/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/distrito federal/g, "ciudad de mexico")
    .replace(/michoacan.*/g, "michoacan")
    .replace(/veracruz.*/g, "veracruz")
    .replace(/coahuila.*/g, "coahuila");
}
// Custom HSL Colors for Charts
const chartColors = {
  blue: '#5cb2af',     // Tu Color 2 (Verde/Azul vibrante)
  purple: '#f76e6e',   // Tu Color 5 (Coral/Rojo)
  emerald: '#7dd8c3',  // Tu Color 3 (Verde claro) 
  rose: '#fbd7a7',     // Tu Color 4 (Arena)
  amber: '#3b7e9b',    // Tu Color 1 (Azul oscuro)
  text: '#334155',     // <- CAMBIO: Texto oscuro para fondo claro
  grid: 'rgba(0, 0, 0, 0.08)' // <- CAMBIO: Cuadrícula oscura y sutil
};
// Start initialization on window load
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
async function initApp() {
  try {
    // Fetch data and geojson
    const [dataRes, geoRes] = await Promise.all([
      fetch('data.json'),
      fetch('mexico.json')
    ]);
    
    appData = await dataRes.json();
    geoJSONData = await geoRes.json();
    
    console.log("Data loaded successfully.");
    
    // Populate Year Select
    populateYearSelect();
    
    // Populate State Trend Select
    populateStateSelect();
    
    // Switch to first dashboard to render initially
    switchDashboard(1);
    
  } catch (error) {
    console.error("Initialization error:", error);
  }
}
function populateYearSelect() {
  const select = document.getElementById('year-select');
  select.innerHTML = "";
  
  // Dashboard 3 overlaps 2016-2024
  const years = Object.keys(appData.dashboard3.relacion_anual).sort((a,b) => b-a);
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.innerText = y;
    select.appendChild(opt);
  });
  
  currentYear = parseInt(years[0]);
}
function populateStateSelect() {
  const select = document.getElementById('state-trend-select');
  select.innerHTML = "";
  
  // National first
  const nationalOpt = document.createElement('option');
  nationalOpt.value = "estados unidos mexicanos";
  nationalOpt.innerText = "Nacional (Estados Unidos Mexicanos)";
  select.appendChild(nationalOpt);
  
  // Sorted states
  const states = Object.keys(appData.dashboard2.trends).sort((a, b) => {
    return appData.dashboard2.trends[a].display.localeCompare(appData.dashboard2.trends[b].display);
  });
  
  states.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.innerText = appData.dashboard2.trends[s].display;
    select.appendChild(opt);
  });
  
  currentStateTrend = "estados unidos mexicanos";
}
// Switch Dashboard Tab
function switchDashboard(panelNum) {
  currentDashboard = panelNum;
  
  // Toggle Active Panel View
  for (let i = 1; i <= 3; i++) {
    const panel = document.getElementById(`panel-${i}`);
    const link = document.querySelectorAll('.nav-link')[i-1];
    
    if (i === panelNum) {
      panel.classList.add('active');
      link.classList.add('active');
    } else {
      panel.classList.remove('active');
      link.classList.remove('active');
    }
  }
  
  // Update Title & Desc
  const title = document.getElementById('dashboard-title');
  const desc = document.getElementById('dashboard-desc');
  const yearControl = document.getElementById('year-control-bar');
  
  if (panelNum === 1) {
    title.innerText = "Dashboard 1: Ingreso Medio por Hora";
    desc.innerText = "Análisis de remuneración horaria promedio de la población ocupada en México (2016-2024)";
    yearControl.style.opacity = 1;
    yearControl.style.pointerEvents = "all";
    renderDashboard1();
  } else if (panelNum === 2) {
    title.innerText = "Dashboard 2: Tasa de Desocupación";
    desc.innerText = "Análisis de desocupación y desempleo a nivel nacional y estatal (2006-2024)";
    yearControl.style.opacity = 0; // Not applicable for overall dashboard 2 which includes 2006 vs 2024
    yearControl.style.pointerEvents = "none";
    renderDashboard2();
  } else if (panelNum === 3) {
    title.innerText = "Dashboard 3: Mapas Coropléticos y Relación";
    desc.innerText = "Distribución geográfica de ingresos, desocupación y análisis de su correlación (2016-2024)";
    yearControl.style.opacity = 1;
    yearControl.style.pointerEvents = "all";
    renderDashboard3();
  }
}
// Listeners for dropdowns
function handleYearChange() {
  const select = document.getElementById('year-select');
  currentYear = parseInt(select.value);
  
  if (currentDashboard === 1) {
    renderDashboard1();
  } else if (currentDashboard === 3) {
    renderDashboard3();
  }
}
function handleStateTrendChange() {
  const select = document.getElementById('state-trend-select');
  currentStateTrend = select.value;
  updateTrendChart();
}
// ----------------------------------------------------
// DASHBOARD 1: INGRESO MEDIO
// ----------------------------------------------------
function renderDashboard1() {
  const db1Data = appData.dashboard1;
  
  // 1. Render KPIs for current year
  const sexDataCurrent = db1Data.ingreso_sexo.find(r => r.periodo === currentYear);
  if (sexDataCurrent) {
    document.getElementById('d1-kpi-total').innerText = `$${sexDataCurrent.total.toFixed(2)}`;
    document.getElementById('d1-kpi-hombres').innerText = `$${sexDataCurrent.hombres.toFixed(2)}`;
    document.getElementById('d1-kpi-mujeres').innerText = `$${sexDataCurrent.mujeres.toFixed(2)}`;
    
    // Calculate gender gap percentage
    const gap = ((sexDataCurrent.hombres - sexDataCurrent.mujeres) / sexDataCurrent.hombres) * 100;
    document.getElementById('d1-kpi-gap').innerHTML = `Brecha de género de <span>${gap.toFixed(1)}%</span>`;
  }
  
  // 2. Render Boxplot (Sex distribution 2016-2024)
  const listHombres = db1Data.ingreso_sexo.map(r => r.hombres);
  const listMujeres = db1Data.ingreso_sexo.map(r => r.mujeres);
  
  drawBoxplotHTML("hombres", listHombres, 30, 60, "$");
  drawBoxplotHTML("mujeres", listMujeres, 30, 60, "$");
  
  // Update Boxplot Y axis values
  document.getElementById('box-y-max').innerText = "$60.00";
  document.getElementById('box-y-mid').innerText = "$45.00";
  document.getElementById('box-y-min').innerText = "$30.00";
  
  // 3. Render Radar Chart (Age Groups)
  const radarData = db1Data.ingreso_edad_grupos[currentYear];
  const radarLabels = Object.keys(radarData);
  const radarValues = Object.values(radarData);
  
  if (radarChartInstance) radarChartInstance.destroy();
  
  const ctxRadar = document.getElementById('chart-radar-edad').getContext('2d');
  radarChartInstance = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: radarLabels,
      datasets: [{
        label: `Ingreso por Hora (${currentYear})`,
        data: radarValues,
        backgroundColor: 'rgba(92, 178, 175, 0.2)',
        borderColor: chartColors.blue,
        borderWidth: 2,
        pointBackgroundColor: chartColors.blue,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: chartColors.blue
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        r: {
          grid: { color: chartColors.grid },
          angleLines: { color: chartColors.grid },
          ticks: {
            color: chartColors.muted,
            backdropColor: 'transparent',
            font: { family: getStyleVal('--font-sans') }
          },
          pointLabels: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans'), size: 11, weight: '500' }
          },
          suggestedMin: 30,
          suggestedMax: 60
        }
      }
    }
  });
  // 4. Render Occupation Bar Chart
  const barData = db1Data.ingreso_ocupacion[currentYear];
  const barLabels = Object.keys(barData);
  const barValues = Object.values(barData);
  
  if (ocupacionBarChartInstance) ocupacionBarChartInstance.destroy();
  
  const ctxBar = document.getElementById('chart-bar-ocupaciones').getContext('2d');
  ocupacionBarChartInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        data: barValues,
        backgroundColor: function(context) {
          const index = context.dataIndex;
          // Gradient or color mapping
          return index % 2 === 0 ? 'rgba(92, 178, 175, 0.85)' : 'rgba(247, 110, 110, 0.85)';
        },
        borderRadius: 8,
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: chartColors.grid },
          ticks: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans') },
            callback: value => `$${value}`
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans'), weight: '500' }
          }
        }
      }
    }
  });
}
// ----------------------------------------------------
// DASHBOARD 2: TASA DESOCUPACION
// ----------------------------------------------------
function renderDashboard2() {
  const db2Data = appData.dashboard2;
  
  // 1. Render KPIs
  // National average trend values
  const lastNac = db2Data.national_trend[db2Data.national_trend.length - 1]; // 2024
  const firstNac = db2Data.national_trend[0]; // 2006
  
  document.getElementById('d2-kpi-2006').innerText = `${firstNac.total.toFixed(2)}%`;
  document.getElementById('d2-kpi-2024').innerText = `${lastNac.total.toFixed(2)}%`;
  
  const change = lastNac.total - firstNac.total;
  const changeEl = document.getElementById('d2-kpi-change');
  if (change <= 0) {
    changeEl.className = "kpi-sub positive";
    changeEl.innerHTML = `Disminución acumulada de <span>${Math.abs(change).toFixed(2)}%</span>`;
  } else {
    changeEl.className = "kpi-sub negative";
    changeEl.innerHTML = `Incremento acumulado de <span>${change.toFixed(2)}%</span>`;
  }
  
  // Find state with lowest desocupacion in 2024
  let minState = "";
  let minVal = 999;
  db2Data.state_comparison.forEach(s => {
    if (s.val_2024 < minVal) {
      minVal = s.val_2024;
      minState = s.display;
    }
  });
  
  document.getElementById('d2-kpi-min-state').innerText = minState;
  document.getElementById('d2-kpi-min-val').innerText = `Tasa de desocupación: ${minVal.toFixed(2)}%`;
  
  // 2. Render Boxplot (2006 vs 2024)
  const list2006 = db2Data.boxplot_data["2006"];
  const list2024 = db2Data.boxplot_data["2024"];
  
  drawBoxplotHTML("2006", list2006, 0, 8.0, "%");
  drawBoxplotHTML("2024", list2024, 0, 8.0, "%");
  
  // Update Boxplot Y axis values
  document.getElementById('box2-y-max').innerText = "8.0%";
  document.getElementById('box2-y-mid').innerText = "4.0%";
  document.getElementById('box2-y-min').innerText = "0.0%";
  // 3. Render State Comparison Bar Chart (2 bars per state: 2006 & 2024)
  // Primero hacemos una copia del arreglo para no modificar el original,
  // y luego lo ordenamos alfabéticamente usando localeCompare.
  const statesComp = [...db2Data.state_comparison].sort((a, b) => 
    a.display.localeCompare(b.display, 'es')
  );
  
  const stateLabels = statesComp.map(s => s.display);
  const data2006 = statesComp.map(s => s.val_2006);
  const data2024 = statesComp.map(s => s.val_2024);
  
  if (desocBarChartInstance) desocBarChartInstance.destroy();
  
  const ctxDesocBar = document.getElementById('chart-bar-estados-comparacion').getContext('2d');
  desocBarChartInstance = new Chart(ctxDesocBar, {
    type: 'bar',
    data: {
      labels: stateLabels,
      datasets: [
        {
          label: '2006',
          data: data2006,
          backgroundColor: 'rgba(251, 215, 167, 0.85)',
          borderRadius: 4
        },
        {
          label: '2024',
          data: data2024,
          backgroundColor: 'rgba(92, 178, 175, 0.85)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: chartColors.text, font: { family: getStyleVal('--font-sans') } }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans'), size: 10 },
            maxRotation: 90,
            minRotation: 90
          }
        },
        y: {
          grid: { color: chartColors.grid },
          ticks: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans') },
            callback: value => `${value}%`
          }
        }
      }
    }
  });
  // 4. Render Trend line chart/histogram
  updateTrendChart();
}
function updateTrendChart() {
  const db2Data = appData.dashboard2;
  let years = [];
  let rates = [];
  let label = "";
  
  if (currentStateTrend === "estados unidos mexicanos") {
    years = db2Data.national_trend.map(r => r.periodo);
    rates = db2Data.national_trend.map(r => r.total);
    label = "Promedio Nacional (México)";
  } else {
    const trend = db2Data.trends[currentStateTrend];
    if (trend) {
      years = trend.years;
      rates = trend.rates;
      label = trend.display;
    }
  }
  
  if (trendChartInstance) trendChartInstance.destroy();
  
  const ctxTrend = document.getElementById('chart-line-trend').getContext('2d');
  trendChartInstance = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: `Tasa de desocupación - ${label}`,
        data: rates,
        borderColor: chartColors.purple,
        backgroundColor: 'rgba(247, 110, 110, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: chartColors.purple,
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: chartColors.text, font: { family: getStyleVal('--font-sans') } }
        },
        y: {
          grid: { color: chartColors.grid },
          ticks: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans') },
            callback: value => `${value.toFixed(1)}%`
          }
        }
      }
    }
  });
}
// ----------------------------------------------------
// DASHBOARD 3: MAPS AND RELATION
// ----------------------------------------------------
function renderDashboard3() {
  const db3Data = appData.dashboard3;
  const dataCurrentYear = db3Data.relacion_anual[currentYear];
  
  // 1. Initialize Leaflet Maps if not already initialized
  initLeafletMaps();
  
  // 2. Draw/Update Map Layers
  updateMapLayers(dataCurrentYear);
  
  // 3. Render Scatter Plot
  const scatterPoints = [];
  const stateLabels = [];
  
  Object.keys(dataCurrentYear).forEach(s => {
    const stateData = dataCurrentYear[s];
    scatterPoints.push({
      x: stateData.income,
      y: stateData.unemployment // Dejamos el valor original (ej. 3.5)
    });
    stateLabels.push(stateData.display);
  });
  
  if (scatterChartInstance) scatterChartInstance.destroy();
  
  const ctxScatter = document.getElementById('chart-scatter-relation').getContext('2d');
  scatterChartInstance = new Chart(ctxScatter, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Entidades Federativas',
        data: scatterPoints,
        backgroundColor: chartColors.blue,
        borderColor: '#fff',
        borderWidth: 1.5,
        pointRadius: 7,
        pointHoverRadius: 9
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              const name = stateLabels[idx];
              return `${name}: Ingreso: $${context.parsed.x.toFixed(2)}/h, Desocupación: ${context.parsed.y.toFixed(2)}%`;
            }
          }
        },
        legend: { display: false }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Ingreso Medio por Hora Estimado ($ Pesos)',
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans'), size: 12, weight: '500' }
          },
          grid: { color: chartColors.grid },
          ticks: { color: chartColors.text, font: { family: getStyleVal('--font-sans') } }
        },
        y: {
          title: {
            display: true,
            text: 'Tasa de Desocupación (%)',
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans'), size: 12, weight: '500' }
          },
          grid: { color: chartColors.grid },
          ticks: {
            color: chartColors.text,
            font: { family: getStyleVal('--font-sans') },
            callback: value => `${value}%`
          }
        }
      }
    }
  });
}
function initLeafletMaps() {
  if (mapIncomeInstance && mapUnemploymentInstance) return;
  
  const mexicoCenter = [23.6345, -102.5528];
  
  // Set up Map Income
  if (!mapIncomeInstance) {
    mapIncomeInstance = L.map('map-income', {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    }).setView(mexicoCenter, 5);
  }
  
  // Set up Map Unemployment
  if (!mapUnemploymentInstance) {
    mapUnemploymentInstance = L.map('map-unemployment', {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    }).setView(mexicoCenter, 5);
  }
}
function updateMapLayers(dataCurrentYear) {
  // Color scale bounds
  let minInc = 999, maxInc = 0;
  let minDesoc = 999, maxDesoc = 0;
  
  Object.values(dataCurrentYear).forEach(s => {
    if (s.income < minInc) minInc = s.income;
    if (s.income > maxInc) maxInc = s.income;
    if (s.unemployment < minDesoc) minDesoc = s.unemployment;
    if (s.unemployment > maxDesoc) maxDesoc = s.unemployment;
  });
  
  // Map Income Layer
  if (mapIncomeLayer) mapIncomeInstance.removeLayer(mapIncomeLayer);
  
  mapIncomeLayer = L.geoJSON(geoJSONData, {
    style: function(feature) {
      const name = feature.properties.name;
      const norm = normalizeName(name);
      const stateData = dataCurrentYear[norm];
      let val = minInc;
      if (stateData) val = stateData.income;
      
      return {
        fillColor: getGradientColor(val, minInc, maxInc, [241, 245, 249], [59, 126, 155]),
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85
      };
    },
    onEachFeature: function(feature, layer) {
      const name = feature.properties.name;
      const norm = normalizeName(name);
      const stateData = dataCurrentYear[norm];
      const val = stateData ? `$${stateData.income.toFixed(2)}/h` : "N/D";
      const display = stateData ? stateData.display : name;
      
      layer.bindPopup(`
        <div class="map-popup">
          <h4>${display}</h4>
          <p>Ingreso estimado: <span>${val}</span></p>
        </div>
      `);
      
      layer.on('mouseover', function(e) {
        this.setStyle({ fillOpacity: 1, weight: 2, color: '#fff' });
      });
      layer.on('mouseout', function(e) {
        mapIncomeLayer.resetStyle(this);
      });
    }
  }).addTo(mapIncomeInstance);
  
  // Map Unemployment Layer
  if (mapUnemploymentLayer) mapUnemploymentInstance.removeLayer(mapUnemploymentLayer);
  
  mapUnemploymentLayer = L.geoJSON(geoJSONData, {
    style: function(feature) {
      const name = feature.properties.name;
      const norm = normalizeName(name);
      const stateData = dataCurrentYear[norm];
      let val = minDesoc;
      if (stateData) val = stateData.unemployment;
      
      return {
        fillColor: getGradientColor(val, minDesoc, maxDesoc, [251, 215, 167], [247, 110, 110]), // De Arena a Coral
        weight: 1,
        opacity: 1,
        color: '#ffffff', // Borde blanco
        fillOpacity: 0.85
      };
    },
    onEachFeature: function(feature, layer) {
      const name = feature.properties.name;
      const norm = normalizeName(name);
      const stateData = dataCurrentYear[norm];
      const val = stateData ? `${(stateData.unemployment * 100).toFixed(2)}%` : "N/D";
      const display = stateData ? stateData.display : name;
      
      layer.bindPopup(`
        <div class="map-popup">
          <h4>${display}</h4>
          <p>Tasa desocupación: <span>${val}</span></p>
        </div>
      `);
      
      layer.on('mouseover', function(e) {
        this.setStyle({ fillOpacity: 1, weight: 2, color: '#fff' });
      });
      layer.on('mouseout', function(e) {
        mapUnemploymentLayer.resetStyle(this);
      });
    }
  }).addTo(mapUnemploymentInstance);
}
// Helpers for color gradients
function getGradientColor(val, min, max, rgb1, rgb2) {
  const ratio = max === min ? 0 : Math.max(0, Math.min(1, (val - min) / (max - min)));
  const r = Math.round(rgb1[0] + ratio * (rgb2[0] - rgb1[0]));
  const g = Math.round(rgb1[1] + ratio * (rgb2[1] - rgb1[1]));
  const b = Math.round(rgb1[2] + ratio * (rgb2[2] - rgb1[2]));
  return `rgb(${r}, ${g}, ${b})`;
}
// ----------------------------------------------------
// BOXPLOT HELPER: HTML / CSS DRAWING
// ----------------------------------------------------
function drawBoxplotHTML(id, values, scaleMin, scaleMax, unit) {
  // 1. Calculate boxplot stats
  const stats = getBoxplotStats(values);
  
  // 2. Set tooltips text
  const prefix = id === "hombres" ? "bh" : "bm";
  
  document.getElementById(`b${id}-max`).innerText = `${unit}${stats.max.toFixed(2)}`;
  document.getElementById(`b${id}-q3`).innerText = `${unit}${stats.q3.toFixed(2)}`;
  document.getElementById(`b${id}-med`).innerText = `${unit}${stats.median.toFixed(2)}`;
  document.getElementById(`b${id}-q1`).innerText = `${unit}${stats.q1.toFixed(2)}`;
  document.getElementById(`b${id}-min`).innerText = `${unit}${stats.min.toFixed(2)}`;
  
  // 3. Map values to percentages of height
  const getPct = (val) => {
    return Math.max(0, Math.min(100, ((val - scaleMin) / (scaleMax - scaleMin)) * 100));
  };
  
  const pctMax = getPct(stats.max);
  const pctQ3 = getPct(stats.q3);
  const pctMed = getPct(stats.median);
  const pctQ1 = getPct(stats.q1);
  const pctMin = getPct(stats.min);
  
  // 4. Update boxplot elements
  const boxBody = document.getElementById(`box-${id}-body`);
  const lineVert = document.getElementById(`box-${id}-line-vert`);
  const lineTop = document.getElementById(`box-${id}-line-top`);
  const lineBottom = document.getElementById(`box-${id}-line-bottom`);
  const lineMedian = document.getElementById(`box-${id}-median`);
  
  // Vertical line runs from min to max
  lineVert.style.bottom = `${pctMin}%`;
  lineVert.style.height = `${pctMax - pctMin}%`;
  
  // Horizontal bars at max and min
  lineTop.style.bottom = `${pctMax}%`;
  lineBottom.style.bottom = `${pctMin}%`;
  
  // Box runs from Q1 to Q3
  boxBody.style.bottom = `${pctQ1}%`;
  boxBody.style.height = `${pctQ3 - pctQ1}%`;
  
  // Median relative to box body
  const bodyHeight = pctQ3 - pctQ1;
  const relativeMedian = bodyHeight === 0 ? 0 : ((pctMed - pctQ1) / bodyHeight) * 100;
  lineMedian.style.bottom = `${relativeMedian}%`;
}
function getBoxplotStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = getMedian(sorted);
  
  const mid = Math.floor(sorted.length / 2);
  const q1 = sorted.length % 2 === 0
    ? getMedian(sorted.slice(0, mid))
    : getMedian(sorted.slice(0, mid));
    
  const q3 = sorted.length % 2 === 0
    ? getMedian(sorted.slice(mid))
    : getMedian(sorted.slice(mid + 1));
    
  return { min, q1, median, q3, max };
}
function getMedian(arr) {
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
// Utility to retrieve CSS values if needed
function getStyleVal(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName);
}

