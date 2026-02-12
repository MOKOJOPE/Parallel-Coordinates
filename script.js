// Parallel Coordinates Visualization

let currentDataset = null;
let currentData = [];

// Dimension definitions for each dataset
const dimensions = {
  2012: [
    "gpa",
    "credits_attempted",
    "credits_passed",
    "current_credits",
    "age",
    "gender",
  ],
  2019: [
    "gender",
    "age_range",
    "credits_attempted",
    "credits_passed",
    "gpa",
    "grad_year",
    "home",
    "major",
  ],
};

// Data types for formatting
const dataTypes = {
  2012: {
    gpa: "numeric",
    credits_attempted: "numeric",
    credits_passed: "numeric",
    current_credits: "numeric",
    age: "numeric",
    gender: "nominal",
  },
  2019: {
    gender: "nominal",
    age_range: "nominal",
    credits_attempted: "numeric",
    credits_passed: "numeric",
    gpa: "numeric",
    grad_year: "numeric",
    home: "nominal",
    major: "nominal",
  },
};

// Divide color assignment based on gender
function getLineColor(d) {
  if (d.gender === "M") return "#1f77b4"; // Blue for Male
  if (d.gender === "F") return "#ff7f0e"; // Orange for Female
  return "#999"; // Gray for unknown
}

// Load and process dataset
async function loadDataset(year) {
  try {
    const response = await fetch(`dataset${year}.json`);
    currentData = await response.json();
    currentDataset = year;
    drawVisualization();
  } catch (error) {
    console.error(`Error loading dataset${year}.json:`, error);
    document.getElementById("visualization").innerHTML =
      `<p style="color: red;">Error loading dataset</p>`;
  }
}

// Draw parallel coordinates visualization
function drawVisualization() {
  const dims = dimensions[currentDataset];
  const types = dataTypes[currentDataset];

  // Clear previous visualization
  document.getElementById("visualization").innerHTML = "";

  // Setup dimensions based on container
  const container = document.getElementById("visualization");
  const containerWidth = container.clientWidth - 40; // Account for padding
  const margin = { top: 50, right: 180, bottom: 20, left: 180 };
  const width = Math.max(
    containerWidth - margin.left - margin.right,
    dims.length * 100,
  );
  const height =
    Math.max(400, Math.min(600, Math.ceil(currentData.length / 15) * 1)) + 200;

  const svgWidth = width + margin.left + margin.right;
  const svgHeight = height + margin.top + margin.bottom;

  const svg = d3
    .select("#visualization")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Build scales for each dimension
  const scales = {};
  const axes = {};

  dims.forEach((dim) => {
    const data = currentData
      .map((d) => d[dim])
      .filter((d) => d !== undefined && d !== null);

    if (types[dim] === "numeric") {
      const min = Math.min(...data);
      const max = Math.max(...data);
      scales[dim] = d3.scaleLinear().domain([min, max]).range([height, 0]);
    } else {
      const uniqueValues = [...new Set(data)].sort();
      scales[dim] = d3.scalePoint().domain(uniqueValues).range([height, 0]);
    }
  });

  // Draw axes
  dims.forEach((dim, i) => {
    const xPosition = (width / (dims.length - 1)) * i;
    const scale = scales[dim];
    const type = types[dim];

    // Draw axis line
    svg
      .append("line")
      .attr("class", "axis-line")
      .attr("x1", xPosition)
      .attr("x2", xPosition)
      .attr("y1", 0)
      .attr("y2", height)
      .style("stroke", "#ccc")
      .style("stroke-width", 1);

    // Axis label
    svg
      .append("text")
      .attr("class", "axis-label")
      .attr("x", xPosition)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .text(dim);

    // Add ticks and labels
    if (type === "numeric") {
      // For numeric data: show 5 ticks (min, 25%, 50%, 75%, max)
      const [min, max] = scale.domain();
      const ticks = [
        min,
        min + (max - min) * 0.25,
        min + (max - min) * 0.5,
        min + (max - min) * 0.75,
        max,
      ];

      ticks.forEach((tick) => {
        const yPosition = scale(tick);

        // Tick mark
        svg
          .append("line")
          .attr("x1", xPosition - 5)
          .attr("x2", xPosition + 5)
          .attr("y1", yPosition)
          .attr("y2", yPosition)
          .style("stroke", "#999")
          .style("stroke-width", 1);

        // Tick label
        svg
          .append("text")
          .attr("class", "axis-tick")
          .attr("x", xPosition - 12)
          .attr("y", yPosition + 4)
          .attr("text-anchor", "end")
          .text(tick.toFixed(2));
      });
    } else {
      // For nominal data: show all unique values
      const uniqueValues = scale.domain();

      uniqueValues.forEach((value) => {
        const yPosition = scale(value);

        // Tick mark
        svg
          .append("line")
          .attr("x1", xPosition - 5)
          .attr("x2", xPosition + 5)
          .attr("y1", yPosition)
          .attr("y2", yPosition)
          .style("stroke", "#999")
          .style("stroke-width", 1);

        // Tick label
        svg
          .append("text")
          .attr("class", "axis-tick")
          .attr("x", xPosition - 12)
          .attr("y", yPosition + 4)
          .attr("text-anchor", "end")
          .text(String(value));
      });
    }
  });

  // Draw data lines
  currentData.forEach((row) => {
    const points = [];

    dims.forEach((dim, i) => {
      const xPosition = (width / (dims.length - 1)) * i;
      const value = row[dim];

      if (value !== undefined && value !== null) {
        const yPosition = scales[dim](value);
        points.push([xPosition, yPosition]);
      }
    });

    // Draw line through all points
    if (points.length > 1) {
      const pathData = points
        .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
        .join("");

      svg
        .append("path")
        .attr("class", "line")
        .attr("d", pathData)
        .style("stroke", getLineColor(row));
    }
  });

  // Add legend
  svg
    .append("rect")
    .attr("x", width + 20)
    .attr("y", -30)
    .attr("width", 150)
    .attr("height", 80)
    .style("fill", "white")
    .style("stroke", "#ccc")
    .style("stroke-width", 1);

  svg
    .append("text")
    .attr("x", width + 30)
    .attr("y", -10)
    .style("font-weight", "bold")
    .style("font-size", "12px")
    .text("Legend:");

  svg
    .append("line")
    .attr("x1", width + 30)
    .attr("x2", width + 50)
    .attr("y1", 5)
    .attr("y2", 5)
    .style("stroke", "#1f77b4")
    .style("stroke-width", 2);

  svg
    .append("text")
    .attr("x", width + 60)
    .attr("y", 10)
    .style("font-size", "12px")
    .text("Male");

  svg
    .append("line")
    .attr("x1", width + 30)
    .attr("x2", width + 50)
    .attr("y1", 30)
    .attr("y2", 30)
    .style("stroke", "#ff7f0e")
    .style("stroke-width", 2);

  svg
    .append("text")
    .attr("x", width + 60)
    .attr("y", 35)
    .style("font-size", "12px")
    .text("Female");

  // Add dataset info
  svg
    .append("text")
    .attr("x", width + 20)
    .attr("y", height - 20)
    .style("font-size", "11px")
    .style("fill", "#666")
    .text(`Records: ${currentData.length}`);
}

// Event listeners
document.getElementById("btn-2012").addEventListener("click", function () {
  document
    .querySelectorAll(".dataset-btn")
    .forEach((btn) => btn.classList.remove("active"));
  this.classList.add("active");
  loadDataset(2012);
});

document.getElementById("btn-2019").addEventListener("click", function () {
  document
    .querySelectorAll(".dataset-btn")
    .forEach((btn) => btn.classList.remove("active"));
  this.classList.add("active");
  loadDataset(2019);
});

// Handle window resize
let resizeTimeout;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(function () {
    if (currentDataset) {
      drawVisualization();
    }
  }, 250);
});

// Load default dataset on page load
loadDataset(2012);
