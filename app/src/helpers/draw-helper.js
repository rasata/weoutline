class DrawHelper {
  static componentToHex(c) {
    let hex = c.toString(16);

    return hex.length == 1 ? '0' + hex : hex;
  }

  static getPixelScaledNumber(num) {
    return num / window.devicePixelRatio;
  }

  static getPointFromEvent(event, canvas) {
    let point;

    if (event.touches) {
      let touches = event.touches[0];
      let rect = canvas.getBoundingClientRect();

      point = [touches.clientX - rect.left, touches.clientY - rect.top];
    } else {
      point = [event.offsetX, event.offsetY];
    }

    return point;
  }

  static getPointWithOffset(point, offset) {
    if (point) {
      return [
        point[0] - offset[0],
        point[1] - offset[1]
      ];
    }

    return point;
  }

  static getPointWithoutOffset(point, offset) {
    if (point) {
      return [
        point[0] + offset[0],
        point[1] + offset[1]
      ];
    }

    return point;
  }

  static getPointsDistance(p1, p2) {
    let diffX = p1[0] - p2[0];

    let diffY = p1[1] - p2[1];

    return Math.sqrt(diffX * diffX + diffY * diffY);
  }

  static checkPointsInViewport(points, offset, scale, canvasSize) {
    let scaledCanvasSize = {
      height: canvasSize.height / scale,
      width: canvasSize.width / scale
    };

    for (let i = 0; i < points.length; i++) {
      if (points[i][0] >= offset[0] && points[i][0] <= offset[0] + scaledCanvasSize.width &&
        points[i][1] >= offset[1] && points[i][1] <= offset[1] + scaledCanvasSize.height) {
          return true;
      }
    }

    return false;
  }

  static colorToHex(value) {
    if (value.charAt(0) === '#') {
      return value;
    } else {
      return DrawHelper.rgbToHex(value);
    }
  }

  static getMidPoint(p1, p2) {
    return [
      p1[0] + (p2[0] - p1[0]) / 2,
      p1[1] + (p2[1] - p1[1]) / 2
    ];
  }

  static rgbToHex(value) {
    let result = /rgb\s*\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/.exec(value);
    let r = parseInt(result[1], 10);
    let g = parseInt(result[2], 10);
    let b = parseInt(result[3], 10);

    return "#" + DrawHelper.componentToHex(r) + DrawHelper.componentToHex(g) + DrawHelper.componentToHex(b);
  }
}

export default DrawHelper;