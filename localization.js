(function () {
    "use strict";

    // A modulo operation that never returns a negative remainder
    Number.prototype.mod = function(n) {
        return (this % n + n) % n;
    };

    // Create an Array object and augment it to support
    // additional functions
    function createMap(width, height, initialValue) {
        var obj = [];
        obj.width = width;
        obj.height = height;

        if (initialValue !== undefined) {
            for (var i = 0; i < width * height; i++) {
                obj[i] = initialValue;
            }   
        }

        obj.positionCount = function() {
            return this.width * this.height;
        };

        obj.getIndex = function(x, y) {
            var newY = y.mod(obj.width) * obj.width;
            var newX = x.mod(obj.height);
            return newY + newX;
        };

        obj.get = function(x, y) {
            return this[this.getIndex(x, y)];
        };

        obj.set = function(x, y, value) {
            this[this.getIndex(x, y)] = value;
            return this;
        };

        obj.clone = function() {
            var cloned = createMap(this.width, this.height);
            for (var i = 0; i < this.width * this.height; i++) {
                cloned[i] = this[i];
            }
            return cloned;
        };

        obj.map = function(callback) {
            var mapped = createMap(this.width, this.height);
            for (var i = 0; i < this.width * this.height; i++) {
                mapped[i] = callback(this[i]);
            }
            return mapped;
        };

        obj.normalize = function(total) {
            var divisor = _.reduce(this, function (memo, num) { return memo + num; }, 0) / total;
            return this.map(function(e) { return e / divisor; });
        };

        obj.move = function(motion, movementCertainty) {
            var moved = createMap(this.width, this.height);
            for (var x = 0; x < this.width; x++) {
                for (var y = 0; y < this.height; y++) {
                    var success = movementCertainty * this.get(x - motion[0], y - motion[1]);
                    var failure = (1 - movementCertainty) * this.get(x, y);
                    moved.set(x, y, success + failure);
                }
            }
            return moved;
        };

        obj.sense = function(measurement, environment, accuracy) {
            var result = createMap(this.width, this.height);
            for (var x = 0; x < this.width; x++) {
                for (var y = 0; y < this.height; y++) {
                    var prediction = this.get(x, y);
                    var color = environment.get(x, y);
                    var multiplier = color === measurement ? accuracy : 1 - accuracy;
                    result.set(x, y, prediction * multiplier);
                }
            }
            return result;
        };

        return obj;
    }

    function fillEnvironment(environment, number) {
        var cloned = environment.clone();
        var positionCount = cloned.positionCount();
        var i;
        
        if (environment.rankings !== undefined) {
            cloned.rankings = environment.rankings;
        }
        else {
            cloned.rankings = [];

            for (i = 0; i < positionCount; i++) {
                cloned.rankings.push(i);
            }

            for (i = 0; i < positionCount; i++) {
                var other = Math.floor(Math.random() * positionCount);
                var temp = cloned.rankings[other];
                cloned.rankings[other] = cloned.rankings[i];
                cloned.rankings[i] = temp;
            }     
        }

        for (i = 0; i < positionCount; i++) {
            cloned[i] = styles[number > cloned.rankings[i] ? 0 : 1];
        }
        return cloned;
    }

    function eachPair(maxX, maxY, callback) {
        for (var x = 0; x < maxX; x++) {
            for (var y = 0; y < maxY; y++) {
                callback(x, y);
            }
        }   
    }

    function drawMap(canvas, colors, position, correctMeasurement) {
        eachPair(16, 16, function(col, row) {
            canvas.fillStyle = colors.get(col, row);
            canvas.fillRect(col * 20, row * 20, 20, 20);
            
            if (position !== undefined && position[0] === col && position[1] === row) {
                canvas.fillStyle = correctMeasurement ? 'black' : 'red';
                canvas.fillRect(col * 20 + 5, row * 20 + 5, 10, 10);
            }
        });

        canvas.strokeStyle = 'black';
        canvas.strokeRect(0, 0, 320, 320);
    }

    function predictionToColor(prediction) {
        var value = 200 - Math.floor(prediction * 200);
        return 'hsla(' + value + ', 80%, 60%, 1)';
    }

    function drawMaps(environment, prediction, position, correctMeasurement) {
        var environmentCanvas = document.getElementById('environment').getContext('2d');
        drawMap(environmentCanvas, environment, position, correctMeasurement);

        var predictionCanvas = document.getElementById('prediction').getContext('2d');
        drawMap(predictionCanvas, prediction.map(predictionToColor));
    }

    function movePosition(position, motion) {
        return [(position[0] + motion[0]).mod(16), (position[1] + motion[1]).mod(16)];
    }

    var styles = ['#ffffaa', '#aaffaa'];
    var environment = fillEnvironment(createMap(16, 16), 70);

    var position = [Math.floor(Math.random() * 16), Math.floor(Math.random() * 16)];
    var prediction = createMap(16, 16, 1.0 / 64);
    var correctMeasurement = true;

    function redraw() {
        environment = fillEnvironment(environment, $('#environment_slider').slider('value'));
        $('#movement_slider_value').html($('#movement_slider').slider('value') + '%');
        $('#sensor_slider_value').html($('#sensor_slider').slider('value') + '%');
        drawMaps(environment, prediction, position, correctMeasurement);        
    }

    $("#environment_slider").slider({min:0, max: 256, value: 92});
    $("#movement_slider").slider({min:0, max: 100, value: 90});
    $("#sensor_slider").slider({min:0, max: 100, value: 90});

    $('.slider').bind('slide', function(event, ui) {
        redraw();
    });

    $('.slider').bind('slidestop', function(event, ui) {
        redraw();

        // Deselect the slider so the the arrow keys can be used
        // for moving the square instead of the slider
        $('a', this).blur();
    });

    // Keep the arrow keys from scrolling the page
    $('body').bind('keydown keypress', function(e) {
        if (e.keyCode > 36 && e.keyCode < 41) {
            e.preventDefault();
        }
    });

    $('body').keyup(function(e) {
        var movements = {37: [-1, 0], 38: [0, -1], 39: [1, 0], 40: [0, 1]};
        var motion = movements[e.keyCode];
        if (motion !== undefined) {
            var movementCertainty = $('#movement_slider').slider('value') / 100.0;
            if (Math.random() < movementCertainty) {
                position = movePosition(position, motion);
            }
            
            prediction = prediction.move(motion, movementCertainty);

            var sensorAccuracy = $('#sensor_slider').slider('value') / 100.0;
            var measurement = environment.get(position[0], position[1]);
            if (Math.random() < sensorAccuracy) {
                correctMeasurement = true;
            }
            else {
                measurement = _.find(styles, function(s) { return s !== measurement; });
                correctMeasurement = false;
            }

            prediction = prediction.sense(measurement, environment, sensorAccuracy);
            prediction = prediction.normalize(1.0);
            redraw();
        }
    });

    redraw();
}());
