﻿// DrawingFunctions provides the code that actually draws on the canvas.

// jslint directive
/*jslint browser: true, devel: true, debug: true, white: true*/

(function () {
    'use strict';
    var drawingFunctions,
        plotCanvas,
        plotContext,
        selectionCanvas;

    // This function computes the numbers to escape that correspond with the extremes of the color gradient.
    // Everything between will be interpolated between these two extremes.
    function getMaxAndMinValues(values, minimumCount, maxIterations) {
        var i, j, value, absoluteMinimum, absoluteMaximum, mapping, accumulator, returnObject;
        absoluteMinimum = Infinity;
        absoluteMaximum = 0;

        // First, compute the number of times each number occurs and keep track of
        // what two numbers are the absolute minimum and maximum numbers in the arrays.
        mapping = {};
        for (i = 0; i < values.length; i += 1) {
            for (j = 0; j < values[i].length; j += 1) {
                value = values[i][j];

                if (value < absoluteMinimum) {
                    absoluteMinimum = value;
                } else if (value > absoluteMaximum && value !== maxIterations) { /* exclude points that iterated to the maximum */
                    absoluteMaximum = value;
                }

                if (mapping[value]) {
                    mapping[value] += 1;
                } else {
                    mapping[value] = 1;
                }
            }
        }

        returnObject = {};
        // Count forwards from the absolute minimum to find what number occurs at least the minimum number of times.
        accumulator = 0;
        for (i = absoluteMinimum; accumulator < minimumCount; i += 1) {
            if (mapping[i]) {
                accumulator += mapping[i];
            }
        }
        returnObject.min = i;
        // Next, count back from the absolute maximum to find what number occurs at least the minimum number of times.
        accumulator = 0;
        for (i = absoluteMaximum; accumulator < minimumCount; i -= 1) {
            if (mapping[i]) {
                accumulator += mapping[i];
            }
        }
        returnObject.max = i;

        return returnObject;
    }

    // Compute the color values associated with a particular number to escape.
    // Return an array of four elements [red, green, blue, alpha]
    function toRgbaArray(x, min, max, colors) {
        var gradient1, gradient2, intensity;

        function getRed() {
            var red1Int, red2Int, thisRedInt;
            red1Int = parseInt(gradient1.substr(1, 2), 16);
            red2Int = parseInt(gradient2.substr(1, 2), 16);
            thisRedInt = red1Int + Math.floor((red2Int - red1Int) * intensity / 255);
            return thisRedInt;
        }
        function getGreen() {
            var green1Int, green2Int, thisGreenInt;
            green1Int = parseInt(gradient1.substr(3, 2), 16);
            green2Int = parseInt(gradient2.substr(3, 2), 16);
            thisGreenInt = green1Int + Math.floor((green2Int - green1Int) * intensity / 255);
            return thisGreenInt;
        }
        function getBlue() {
            var blue1Int, blue2Int, thisBlueInt;
            blue1Int = parseInt(gradient1.substr(5, 2), 16);
            blue2Int = parseInt(gradient2.substr(5, 2), 16);
            thisBlueInt = blue1Int + Math.floor((blue2Int - blue1Int) * intensity / 255);
            return thisBlueInt;
        }

        gradient1 = colors[0];
        gradient2 = colors[1];

        x = Math.max(x, min);
        x = Math.min(x, max);

        intensity = Math.floor(255 * (x - min) / (max - min));

        return [getRed(intensity), getGreen(intensity), getBlue(intensity), 255];
    }

    // compute the array of color values that tell what colors correspond to each number to escape.
    function computeGradientRgbaArray(arrayOfRowResults, maxIterations, colors) {
        // Before we compute anything else, we need to find what values in the numbers to escape
        // correspond to the extremeties of the colors in the gradient.
        // I want to make sure that the value that corresponds to the maximum and minimum are not just one-off flukes,
        // so I stipulate that the maximum value and minimum value must each cover a certain fraction of pixels on the canvas.
        var i, minimumCount, min, max, o, array;
        minimumCount = Math.floor(arrayOfRowResults.length * arrayOfRowResults.length * 0.01);
        o = getMaxAndMinValues(arrayOfRowResults, minimumCount, maxIterations);
        min = o.min;
        max = o.max;

        // Compute the color that corresponds to any value returned from computeRow.
        array = [];
        for (i = 0; i <= max; i += 1) {
            array.push(toRgbaArray(i, min, max, colors));
        }

        // Compute the color to use for points that never escape.
        array.push([
            parseInt(colors[2].substr(1, 2), 16),
            parseInt(colors[2].substr(3, 2), 16),
            parseInt(colors[2].substr(5, 2), 16),
            255
        ]);

        return array;
    }

    plotCanvas = document.getElementById('plot');
    plotContext = plotCanvas.getContext('2d');
    selectionCanvas = document.getElementById('selection');

    drawingFunctions = {};

    // Set the width and height of the canvas to draw on, in pixels.
    drawingFunctions.setPlotDimensions = function setPlotDimensions(width, height) {
        plotCanvas.width = selectionCanvas.width = width;
        plotCanvas.height = selectionCanvas.height = height;
    };

    // Takes an array of arrays with the inner arrays representing columns and the outer arrays representing rows.    
    drawingFunctions.colorPixels = function colorPixels(arrayOfRowResults, maxIterations, colors) {
        var rgbaArray, rgba, value, redIndex, imageData, rowNumber, columnNumber;

        rgbaArray = computeGradientRgbaArray(arrayOfRowResults, maxIterations, colors);

        // Get a reference to the data that describes the image on the canvas.
        // We are about to modify this data "by hand"
        imageData = plotContext.getImageData(0, 0, plotCanvas.width, plotCanvas.height);

        for (rowNumber = 0; rowNumber < plotCanvas.height; rowNumber += 1) {
            for (columnNumber = 0; columnNumber < plotCanvas.width; columnNumber += 1) {
                // Each element in imageData is 4 numbers in an array representing the
                // red, green, blue, and alpha values at that pixel.
                // Therefore, it is width * height * 4 elements long.
                // The index of the red value for the pixel at (x,y), therefore, is
                // (y * width + x) * 4 and the next three are green, blue, and alpha.

                // This array of row results tells the number to escape for each point on the graph.
                // The rgbaArray tells us what color a point should be for each possible value.
                value = arrayOfRowResults[rowNumber][columnNumber];

                // If the value is maxIterations, then we assume that the point never escapes for this point and color
                // it with the interior color, which is the very last element in the rgbaArray.
                if (value === maxIterations) {
                    rgba = rgbaArray[rgbaArray.length - 1];
                } else if (value >= rgbaArray.length - 1) {
                    rgba = rgbaArray[rgbaArray.length - 2];
                } else {
                    rgba = rgbaArray[value];
                }

                // I get an error sometimes where is says "rgba is undefined".  This little bit of code is meant to catch that so I can figure it out.
                if (!rgba) {
                    alert('An error occurred.\nWe suggest that you click your browser\'s "Back" button to try again.');
                    debugger;
                }

                redIndex = (rowNumber * plotCanvas.width + columnNumber) * 4;
                // Red
                imageData.data[redIndex] = rgba[0];
                // Green
                imageData.data[redIndex + 1] = rgba[1];
                // Blue
                imageData.data[redIndex + 2] = rgba[2];
                // Alpha
                imageData.data[redIndex + 3] = rgba[3];
            }
        }
        plotContext.putImageData(imageData, 0, 0);
    };

    // Assign the drawing functions module to a property of the page to make it global.
    window.drawingFunctions = drawingFunctions;
} ());