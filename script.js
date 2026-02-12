let currentDataset = null;
let currentData = [];
let currentDimensions = [];
let currentDataTypes = {};

// HELPER FUNCTIONS: Data Type Detection and Axis Label Extraction

/**
 * Extracts axis labels (column names) directly from the loaded dataset
 * by reading the keys of the first data record at runtime.
 * This ensures the program adapts to any JSON structure without hard-coding.
 *
 * @param {Array} data - The loaded dataset (array of objects)
 * @returns {Array} Array of column names to use as axis labels
 */
function extractDimensions(data) {
  if (!data || data.length === 0) return [];
  // Extract all keys from the first record - these become our axis labels
  return Object.keys(data[0]);
}

/**
 * Automatically detects whether each column contains numeric or nominal (categorical) data
 * by sampling values and checking if they are numbers.
 * This allows the program to intelligently choose appropriate scales without preset metadata.
 *
 * @param {Array} data - The loaded dataset
 * @param {Array} dimensions - The column names to analyze
 * @returns {Object} Map of dimension names to data types ("numeric" or "nominal")
 */
function detectDataTypes(data, dimensions) {
  const types = {};

  dimensions.forEach((dim) => {
    // Collect all non-null values for this dimension
    const values = data
      .map((d) => d[dim])
      .filter((v) => v !== undefined && v !== null);

    // A column is numeric if all sampled values are numbers or can be converted to numbers
    const isNumeric =
      values.length > 0 &&
      values.every((v) => {
        const num = Number(v);
        return !isNaN(num) && isFinite(num);
      });

    types[dim] = isNumeric ? "numeric" : "nominal";
  });

  return types;
}

// COLOR ASSIGNMENT: Visual encoding of data points by gender

/**
 * Assigns line colors based on the gender attribute.
 * Used to visually distinguish between male and female records in the visualization.
 * Color mapping: Male = Blue, Female = Orange, Unknown = Gray
 *
 * @param {Object} d - A single data record
 * @returns {string} Hex color code for this record's line
 */
function getLineColor(d) {
  if (d.gender === "M") return "#1f77b4"; // Blue for Male
  if (d.gender === "F") return "#ff7f0e"; // Orange for Female
  return "#999"; // Gray for unknown/missing gender
}

// DATA LOADING: Fetch and initialize datasets at runtime

/**
 * Loads a dataset from a JSON file, extracts its structure dynamically,
 * and triggers visualization.
 * This demonstrates runtime dataset switching capability.
 *
 * @param {number} year - The year identifier (2012 or 2019)
 */
async function loadDataset(year) {
  try {
    const response = await fetch(`dataset${year}.json`);
    currentData = await response.json();
    currentDataset = year;

    // Extract axis labels directly from the loaded data at runtime
    currentDimensions = extractDimensions(currentData);

    // Auto-detect numeric vs categorical data types from the actual values
    currentDataTypes = detectDataTypes(currentData, currentDimensions);

    // Trigger visualization with the dynamically-detected structure
    drawVisualization();
  } catch (error) {
    console.error(`Error loading dataset${year}.json:`, error);
    document.getElementById("visualization").innerHTML =
      `<p style="color: red;">Error loading dataset</p>`;
  }
}

// VISUALIZATION RENDERING: Draw the complete parallel coordinates plot

/**
 * Main visualization function that:
 * 1. Uses dynamically-extracted axis labels (dimensions)
 * 2. Uses auto-detected data types (numeric vs categorical)
 * 3. Computes min/max values for each numeric axis
 * 4. Maps data values to Y-coordinates appropriately
 * 5. Draws connected line segments for each data record
 * 6. Scales responsively to the container size
 */
function drawVisualization() {
  // Use the runtime-extracted dimensions (axis labels from the data)
  const dims = currentDimensions;
  // Use the runtime-detected data types (numeric vs nominal)
  const types = currentDataTypes;

  // Clear previous visualization
  document.getElementById("visualization").innerHTML = "";

  // RESPONSIVE LAYOUT: Calculate SVG dimensions based on current container size
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

  // Create SVG element with viewBox for clean responsive scaling
  const svg = d3
    .select("#visualization")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // SCALE COMPUTATION: Build D3 scales for each dimension

  // For each axis, we either compute min/max values (numeric) or unique values (nominal)

  const scales = {};
  const axes = {};

  dims.forEach((dim) => {
    // Extract all non-null values for this dimension
    const data = currentData
      .map((d) => d[dim])
      .filter((d) => d !== undefined && d !== null);

    if (types[dim] === "numeric") {
      // NUMERIC DATA: Compute min and max values for the range
      // This demonstrates how the program finds the extent of numeric axes
      const min = Math.min(...data);
      const max = Math.max(...data);

      // Create a linear scale: maps [min, max] input domain to [height, 0] output range
      // Input: actual data values
      // Output: Y-coordinates (height=bottom, 0=top, inverted for screen coordinates)
      scales[dim] = d3.scaleLinear().domain([min, max]).range([height, 0]);
    } else {
      // CATEGORICAL (NOMINAL) DATA: Use unique values as domain points
      // scalePoint creates evenly-spaced positions for each category
      const uniqueValues = [...new Set(data)].sort();
      scales[dim] = d3.scalePoint().domain(uniqueValues).range([height, 0]);
    }
  });

  // AXIS RENDERING: Draw vertical axes with labels and tick marks

  dims.forEach((dim, i) => {
    // Calculate horizontal position across the canvas
    const xPosition = (width / (dims.length - 1)) * i;
    const scale = scales[dim];
    const type = types[dim];

    // Draw vertical axis line
    svg
      .append("line")
      .attr("class", "axis-line")
      .attr("x1", xPosition)
      .attr("x2", xPosition)
      .attr("y1", 0)
      .attr("y2", height)
      .style("stroke", "#ccc")
      .style("stroke-width", 1);

    // Draw axis label (dimension name extracted from data at runtime)
    svg
      .append("text")
      .attr("class", "axis-label")
      .attr("x", xPosition)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .text(dim);

    // NUMERIC AXES: Show 5 evenly-spaced tick marks from min to max

    if (type === "numeric") {
      // COMPUTING MIN/MAX: Extract exact min and max from the scale's domain
      const [min, max] = scale.domain();

      // Create 5 evenly-spaced tick positions: 0%, 25%, 50%, 75%, 100%
      // This demonstrates how we partition the numeric range for display
      const ticks = [
        min,
        min + (max - min) * 0.25,
        min + (max - min) * 0.5,
        min + (max - min) * 0.75,
        max,
      ];

      ticks.forEach((tick) => {
        // COMPUTING Y-VALUES FOR NUMERIC DATA:
        // Use the D3 scale to map the numeric value to a Y-pixel coordinate
        // scale(tick) converts a data value to its corresponding position on the axis
        const yPosition = scale(tick);

        // Draw small tick mark
        svg
          .append("line")
          .attr("x1", xPosition - 5)
          .attr("x2", xPosition + 5)
          .attr("y1", yPosition)
          .attr("y2", yPosition)
          .style("stroke", "#999")
          .style("stroke-width", 1);

        // Label the tick with its numeric value
        svg
          .append("text")
          .attr("class", "axis-tick")
          .attr("x", xPosition - 12)
          .attr("y", yPosition + 4)
          .attr("text-anchor", "end")
          .text(tick.toFixed(2));
      });
    } else {
      // CATEGORICAL AXES: Show a tick mark and label for each unique value

      const uniqueValues = scale.domain();

      uniqueValues.forEach((value) => {
        // COMPUTING Y-VALUES FOR NOMINAL DATA:
        // Use scalePoint to map categorical values to evenly-spaced Y positions
        // scale(value) converts a category string to its pixel position
        const yPosition = scale(value);

        // Draw small tick mark for this category
        svg
          .append("line")
          .attr("x1", xPosition - 5)
          .attr("x2", xPosition + 5)
          .attr("y1", yPosition)
          .attr("y2", yPosition)
          .style("stroke", "#999")
          .style("stroke-width", 1);

        // Label the tick with the category name
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

  // DATA LINES: Draw connected line segments for each data record

  // Each record becomes a polyline connecting its values across all axes

  currentData.forEach((row) => {
    const points = [];

    // Collect x,y coordinates for each dimension of this record
    dims.forEach((dim, i) => {
      const xPosition = (width / (dims.length - 1)) * i;
      const value = row[dim];

      if (value !== undefined && value !== null) {
        // Map the data value to a Y-coordinate using the appropriate scale
        // For numeric: linear interpolation between min and max
        // For categorical: predefined position for that category
        const yPosition = scales[dim](value);
        points.push([xPosition, yPosition]);
      }
    });

    // DRAWING CONNECTED LINE SEGMENTS:
    // Create an SVG path using M (move) and L (line) commands
    // M = move to first point, L = draw line to subsequent points
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

  // LEGEND: Display color coding for gender-based line coloring

  // LEGEND: Display color coding for gender-based line coloring

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

// INTERACTIVE CONTROLS: Button listeners for dataset switching

// Load 2012 dataset when user clicks the "Load 2012 Dataset" button
// Demonstrates runtime dataset switching capability
document.getElementById("btn-2012").addEventListener("click", function () {
  document
    .querySelectorAll(".dataset-btn")
    .forEach((btn) => btn.classList.remove("active"));
  this.classList.add("active");
  loadDataset(2012);
});

// Load 2019 dataset when user clicks the "Load 2019 Dataset" button
// Demonstrates that the program adapts to different data structures automatically
document.getElementById("btn-2019").addEventListener("click", function () {
  document
    .querySelectorAll(".dataset-btn")
    .forEach((btn) => btn.classList.remove("active"));
  this.classList.add("active");
  loadDataset(2019);
});

// RESPONSIVE BEHAVIOR: Handle window resize events

// When the user resizes the window, redraw the visualization to scale cleanly
// Debounced with 250ms delay to avoid excessive redraws during active resizing
let resizeTimeout;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(function () {
    if (currentDataset) {
      drawVisualization();
    }
  }, 250);
});

// INITIALIZATION: Load default dataset on page load

// Start by displaying the 2012 dataset
loadDataset(2012);
