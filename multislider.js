'use strict';

angular.module('angularMultiSlider', [])
  .directive('multiSlider', function($compile) {
    var events = {
      mouse: {
        start: 'mousedown',
        move: 'mousemove',
        end: 'mouseup'
      },
      touch: {
        start: 'touchstart',
        move: 'touchmove',
        end: 'touchend'
      }
    };

    function roundStep(value, precision, step, floor) {
      var remainder = (value - floor) % step;
      var steppedValue = remainder > (step / 2) ? value + step - remainder : value - remainder;
      var decimals = Math.pow(10, precision);
      var roundedValue = steppedValue * decimals / decimals;
      return parseFloat(roundedValue.toFixed(precision));
    }

    function offset(element, position) {
      return element.css({
        left: position
      });
    }

    function pixelize(position) {
      return parseInt(position) + "px";
    }

    function contain(value) {
      if (isNaN(value)) return value;
      return Math.min(Math.max(0, value), 100);
    }

    function overlaps(b1, b2, elevate) {
      function comparePositions(p1, p2) {
        var r1 = p1[0] < p2[0] ? p1 : p2;
        var r2 = p1[0] < p2[0] ? p2 : p1;
        return r1[1] > r2[0] || r1[0] === r2[0];
      }

      var posB1 = [[ b1.offsetLeft, b1.offsetLeft + b1.offsetWidth ], [ b1.offsetTop, b1.offsetTop -  b1.scrollTop + b1.offsetHeight ]],
          posB2 = [[ b2.offsetLeft, b2.offsetLeft + b2.offsetWidth ], [ b2.offsetTop, b2.offsetTop -  b2.scrollTop + b2.offsetHeight ]];

      if (elevate >= 1) { //Tests to see if b1 will overlap IF we shift it up
        posB1[1] = [b1.offsetTop - (b1.offsetHeight * elevate), b1.offsetTop -  b1.scrollTop - (b1.offsetHeight * (elevate-1))];
      } else if (elevate <=1) { //Tests to see if b1 will overlap IF we shift it down
        posB1[1] = [b1.offsetTop + (b1.offsetHeight * (elevate * -1) ), b1.offsetTop -  b1.scrollTop + (b1.offsetHeight * ((elevate * -1)+ 1))];
      }

      return comparePositions( posB1[0], posB2[0] ) && comparePositions( posB1[1], posB2[1] );
    }

    return {
      restrict: 'EA',
      require: '?ngModel',
      scope: {
        floor       : '@',
        ceiling     : '@',
        step        : '@',
        precision   : '@',
        bubbles     : '@',
        sliders     : '=ngModel'
      },
      template :
      '<div class="bar"></div>' +
      '<div class="limit floor">{{ floor }}</div>' +
      '<div class="limit ceiling">{{ ceiling }}</div>',

      link : function(scope, element, attrs, ngModel) {
        if (!ngModel) return; // do nothing if no ng-model

        //base copy to see if sliders returned to original
        var original;

        ngModel.$render = function() {
          original = angular.copy(scope.sliders);
        };

        element.addClass('angular-multi-slider');

        // DOM Components
        var sliderStr = '';
        angular.forEach(scope.sliders, function(slider, key){
          sliderStr += ('<div class="handle"></div><div class="bubble">{{ sliders[' + key.toString() + '].title }}{{ sliders[' + key.toString() + '].value}}</div>');
        });
        var sliderControls = angular.element(sliderStr);
        element.append(sliderControls);
        $compile(sliderControls)(scope);

        var children  = element.children();
        var bar       = angular.element(children[0]),
          ngDocument  = angular.element(document),
          floorBubble = angular.element(children[1]),
          ceilBubble  = angular.element(children[2]),
          bubbles = [],
          handles = [];

        //var sliderChildren = sliderControls.children();
        angular.forEach(scope.sliders, function(slider, key) {
          handles.push(angular.element(children[(key * 2) + 3]));
          bubbles.push(angular.element(children[(key * 2) + 4]));
        });

        // Control Dimensions Used for Calculations
        var handleHalfWidth = 0,
          barWidth = 0,
          minOffset = 0,
          maxOffset = 0,
          minValue = 0,
          maxValue = 0,
          valueRange = 0,
          offsetRange = 0,
          baseTop = -36,
          baseHeight = 30;

        if (scope.step === undefined) scope.step = 1;
        if (scope.floor === undefined) scope.floor = 0;
        if (scope.ceiling === undefined) scope.ceiling = 500;
        if (scope.precision === undefined) scope.precision = 0;
        if (scope.bubbles === undefined) scope.bubbles = false;

        var bindingsSet = false;

        var updateCalculations = function() {
          scope.floor = roundStep(parseFloat(scope.floor), parseInt(scope.precision), parseFloat(scope.step), parseFloat(scope.floor));
          scope.ceiling = roundStep(parseFloat(scope.ceiling), parseInt(scope.precision), parseFloat(scope.step), parseFloat(scope.floor));

          angular.forEach(scope.sliders, function(slider) {
            slider.value = roundStep(parseFloat(slider.value), parseInt(scope.precision), parseFloat(scope.step), parseFloat(scope.floor));
          });

          handleHalfWidth = handles[0][0].offsetWidth / 2;
          barWidth = bar[0].offsetWidth;
          minOffset = 0;
          maxOffset = barWidth - handles[0][0].offsetWidth;
          minValue = parseFloat(scope.floor);
          maxValue = parseFloat(scope.ceiling);
          valueRange = maxValue - minValue;
          offsetRange = maxOffset - minOffset;
        };

        var updateDOM = function () {

          updateCalculations();

          var percentOffset = function (offset) {
            return contain(((offset - minOffset) / offsetRange) * 100);
          };

          var percentValue = function (value) {
            return contain(((value - minValue) / valueRange) * 100);
          };

          var pixelsToOffset = function (percent) {
            return pixelize(percent * offsetRange / 100);
          };

          var setHandles = function () {
            offset(ceilBubble, pixelize(barWidth - ceilBubble[0].offsetWidth));
            angular.forEach(scope.sliders, function(slider,key){
              if (slider.color) {
                handles[key].css({ "background-color": slider.color });
              }

              offset(handles[key], pixelsToOffset(percentValue(slider.value)));
              offset(bubbles[key], pixelize(handles[key][0].offsetLeft - (bubbles[key][0].offsetWidth / 2) + handleHalfWidth));
            });
          };

          var overlapCheck = function(currentRef) {
            var delta = 28;
            var baseTop = -36;
            var collides = false;
            for (var x = 0; x < scope.sliders.length; x ++) {
              if (x != currentRef && overlaps(bubbles[currentRef][0], bubbles[x][0],0)) {
                collides = true;
                break;
              }
            }

            if (collides) {
              //TODO: Determine How far does it need to move up without another collision?
              handles[currentRef].css({top: pixelize(baseTop), height: pixelize(baseHeight + delta)});
              bubbles[currentRef].css({top: pixelize(baseTop - delta)});
            }

            if (bubbles[currentRef][0].offsetTop < baseTop) {
              //Check if can move back down... TODO: Determine how far down can it go without another collision
              var canLower = true;
              for (var y = 0; y < scope.sliders.length; y ++) {
                if (y != currentRef && overlaps(bubbles[currentRef][0], bubbles[y][0],-1)) {
                  canLower = false;
                }
              }
              if (canLower) {
                handles[currentRef].css({top: '', height: ''});
                bubbles[currentRef].css({top: ''});
              }
            }
          };

          var bind = function (handle, bubble, currentRef, events) {
            var onEnd = function () {
              handle.removeClass('grab');
              bubble.removeClass('grab');
              if (!(''+scope.bubbles === 'true')) {
                bubble.removeClass('active');
              }

              ngDocument.unbind(events.move);
              ngDocument.unbind(events.end);

              if (angular.equals(scope.sliders, original)) {
                ngModel.$setPristine();
              }

              scope.$apply();
            };

            var onMove = function (event) {
              // Suss out which event type we are capturing and get the x value
              var eventX = 0;
              if (event.clientX !== undefined) {
                eventX = event.clientX;
              }
              else if ( event.touches !== undefined && event.touches.length) {
                eventX = event.touches[0].clientX;
              }
              else if ( event.originalEvent !== undefined &&
                event.originalEvent.changedTouches !== undefined &&
                event.originalEvent.changedTouches.length) {
                eventX = event.originalEvent.changedTouches[0].clientX;
              }

              var newOffset = Math.max(Math.min((eventX - element[0].getBoundingClientRect().left - handleHalfWidth), maxOffset), minOffset),
                newPercent = percentOffset(newOffset),
                newValue = minValue + (valueRange * newPercent / 100.0);

              newValue = roundStep(newValue, parseInt(scope.precision), parseFloat(scope.step), parseFloat(scope.floor));
              scope.sliders[currentRef].value = newValue;

              setHandles();

              //This is my code for adjusting a slider. Might make this a property for resource conservation...
              overlapCheck(currentRef);

              ngModel.$setDirty();
              scope.$apply();
            };

            var onStart = function (event) {
              updateCalculations();
              bubble.addClass('active grab');
              handle.addClass('active grab');
              setHandles();
              event.stopPropagation();
              event.preventDefault();
              ngDocument.bind(events.move, onMove);
              return ngDocument.bind(events.end, onEnd);
            };

            handle.bind(events.start, onStart);
          };

          var setBindings = function () {
            var method, i;
            var inputTypes = ['touch', 'mouse'];
            for (i = 0; i < inputTypes.length; i++) {
              method = inputTypes[i];
              angular.forEach(scope.sliders, function(slider, key){
                bind(handles[key], bubbles[key], key, events[method]);
              });
            }

            bindingsSet = true;
          };

          if (!bindingsSet) {
            setBindings();

            // Timeout needed because bubbles offsetWidth is incorrect during initial rendering of html elements
            setTimeout( function() {
              if (''+scope.bubbles === 'true') {
                angular.forEach(bubbles, function(bubble) {
                  bubble.addClass('active');
                });
              }
              updateCalculations();
              setHandles();
            }, 10);
          }
        };

        // Watch Models based on mode
        scope.$watch('sliders', updateDOM);
        // Update on Window resize
        window.addEventListener('resize', updateDOM);
      }
    }
  });