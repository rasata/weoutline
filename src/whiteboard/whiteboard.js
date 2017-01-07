import { ShapeType } from '../draw/shape';
import Draw from '../draw/draw';
import DrawLine from '../draw/draw-line';
import Eraser from '../draw/eraser';
import Toolbar from '../toolbar/toolbar';
import Tools from '../draw/tools';
import Utils from '../utils/utils';

class Whiteboard {
  constructor(config) {
    config = config || {};

    this._config = config;

    this._shapes = config.shapes || [];
    this._offset = config.offset || [0, 0];

    this._setupCanvas();
    this._setupContext();
    this._setupToolbar();

    this._attachListeners();

    this._setActiveTool();

    this._resizeCanvas();
    this.redraw();
  }

  destroy() {
    this._detachListeners();
  }

  drawRulers() {
    this._drawHorizontalRuler();

    this._drawVerticalRuler();
  }

  drawShapes() {
    for (let i = 0; i < this._shapes.length; i++) {
      if (this._shapes[i].type === ShapeType.LINE) {
        let points = this._shapes[i].points.map((point) => {
          return Utils.getPointWithOffset(point, this._offset);
        });

        Draw.line(points, this._context, {
          color: this._shapes[i].color,
          globalCompositeOperation: 'source-over',
          lineCap: 'round',
          lineJoin: 'round',
          size: this._shapes[i].size
        });
      }
    }
  }

  redraw() {
    this._context.clearRect(0, 0, this._context.canvas.width, this._context.canvas.height);

    this.drawRulers();

    this.drawShapes();
  }

  setConfig(config) {
    Object.assign(this._config, config);

    this._setActiveTool();
  }

  _attachListeners() {
    this._onTouchStartListener = this._onTouchStart.bind(this);
    this._onTouchMoveListener = this._onTouchMove.bind(this);
    this._onWheelListener = this._onScroll.bind(this);
    this._onContextMenuListener = function(e) { e.preventDefault(); };
    this._resizeListener = this._onResize.bind(this);
    this._onFullscreenChangeListener = this._onFullscreenChange.bind(this);

    if (Utils.isTouchDevice()) {
      this._canvasElement.addEventListener('touchstart', this._onTouchStartListener);
      this._canvasElement.addEventListener('touchmove', this._onTouchMoveListener);
    } else {
      this._canvasElement.addEventListener('wheel', this._onWheelListener);
      this._canvasElement.addEventListener('contextmenu', this._onContextMenuListener);
    }

    document.addEventListener(Utils.getFullscreenChangeEventName(this._canvasElement), this._onFullscreenChangeListener);

    window.addEventListener('orientationchange', this._resizeListener);
    window.addEventListener('resize', this._resizeListener);
  }

  _clearWhiteboard() {
    if (confirm('Are you sure you want to erase the whole whiteboard?')) {
      this._shapes.length = 0;

      this._offset[0] = 0;
      this._offset[1] = 0;

      this.redraw();
    }
  }

  _detachListeners() {
    document.removeEventListener(Utils.getFullscreenChangeEventName(this._canvasElement), this._onFullscreenChangeListener);
    this._canvasElement.removeEventListener('contextmenu', this._onContextMenuListener);
    this._canvasElement.removeEventListener('touchmove', this._onTouchMoveListener);
    this._canvasElement.removeEventListener('touchstart', this._onTouchStartListener);
    this._canvasElement.removeEventListener('wheel', this._onWheelListener);
    window.removeEventListener('orientationchange', this._resizeListener);
    window.removeEventListener('resize', this._resizeListener);
  }

  _drawHorizontalRuler() {
    for (let i = 0; i <= this._config.width; i += 20) {
      this._context.beginPath();
      this._context.strokeStyle = '#000000';
      this._context.lineWidth = 1;
      this._context.moveTo(i - this._offset[0], 0);

      if (i % 100 === 0) {
        this._context.lineTo(i - this._offset[0], 10);
      } else {
        this._context.lineTo(i - this._offset[0], 5);
      }
      this._context.stroke();

      if (i % 500 === 0 && i > 0) {
        this._context.strokeStyle = '#000000';
        this._context.textAlign = i + 20 < this._config.width ? 'center' : 'end';
        this._context.textBaseline = 'alphabetic';
        this._context.font = this._config.rulerFontSize + 'px';
        this._context.fillText(i, i - this._offset[0], 20);
      }
    }
  }

  _drawVerticalRuler() {
    for (let i = 20; i <= this._config.height; i += 20) {
      this._context.beginPath();
      this._context.strokeStyle = '#000000';
      this._context.lineWidth = 1;
      this._context.moveTo(0, i - this._offset[1]);

      if (i % 100 === 0) {
        this._context.lineTo(10, i - this._offset[1]);
      } else {
        this._context.lineTo(5, i - this._offset[1]);
      }
      this._context.stroke();

      if (i % 500 === 0) {
        this._context.strokeStyle = '#000000';
        this._context.textAlign = 'start';
        this._context.textBaseline = i + 20 < this._config.height ? 'middle' : 'bottom';
        this._context.font = this._config.rulerFontSize + 'px';
        this._context.fillText(i, 12, i - this._offset[1]);
      }
    }
  }

  _getAllowedOffset(scrollData) {
    let tmpOffsetWidth = this._offset[0] + scrollData[0];
    let tmpOffsetHeight = this._offset[1] + scrollData[1];

    let allowedOffset = [];

    if ((scrollData[0] < 0 && tmpOffsetWidth < 0) ||
      (scrollData[0] > 0 && tmpOffsetWidth + this._canvasElement.width > this._config.width)) {
      allowedOffset[0] = 0;
    } else {
      allowedOffset[0] = scrollData[0];
    }

    if ((scrollData[1] < 0 && tmpOffsetHeight < 0) ||
      (scrollData[1] > 0 && tmpOffsetHeight + this._canvasElement.height > this._config.height)) {
      allowedOffset[1] = 0;
    } else {
      allowedOffset[1] = scrollData[1];
    }

    return allowedOffset;
  }

  _handleFullscreen() {
    let mainContainerNode = document.getElementById('mainContainer');

    let inFullscreen = Utils.getFullScreenModeValue();

    if (inFullscreen) {
      Utils.exitFullscreen(mainContainerNode);
    } else {
      Utils.requestFullscreen(mainContainerNode);
    }
  }

  _getToolSize() {
    let size;

    if (this._config.activeTool === Tools.line) {
      size = this._config.penSize;
    }

    return size;
  }

  _onFullscreenChange() {
    let values = this._toolbar.getValues();

    values.fullscreen = Utils.getFullScreenModeValue();

    this._toolbar.setValues(values);
  }

  _onResize() {
    let canvasContainerEl = this._canvasElement.parentNode;

    let newHeight = canvasContainerEl.offsetHeight;
    let newWidth = canvasContainerEl.offsetWidth;

    this._canvasElement.setAttribute('height', newHeight);
    this._canvasElement.setAttribute('width', newWidth);

    this._updateOffset({
      canvasHeight: newHeight,
      canvasWidth: newWidth,
      height: this._config.height,
      width: this._config.width
    });

    this.redraw();
  }

  _onScroll(event) {
    let allowedOffset;

    if (event.deltaMode === 0) {
      event.preventDefault();

      allowedOffset = this._getAllowedOffset([event.deltaX, event.deltaY]);

      this._offset[0] += allowedOffset[0];
      this._offset[1] += allowedOffset[1];

      this.redraw();
    } else if (event.touches.length > 1) {
      event.preventDefault();

      let curPoint = [event.touches[0].pageX, event.touches[0].pageY];

      allowedOffset = this._getAllowedOffset([
        (curPoint[0] - this._lastDragPoint[0]) * -1,
        (curPoint[1] - this._lastDragPoint[1]) * -1
      ]);

      this._offset[0] += allowedOffset[0];
      this._offset[1] += allowedOffset[1];

      this._lastDragPoint[0] = curPoint[0];
      this._lastDragPoint[1] = curPoint[1];

      this.redraw();
    }

    this._drawer.setConfig({
      offset: this._offset
    });
  }

  _onShapeCreatedCallback(shape) {
    // change points coordinates according to 0,0
    for (let i = 0; i < shape.points.length; i++) {
      let point = shape.points[i];
      point[0] += this._offset[0];
      point[1] += this._offset[1];
    }

    shape.id = Date.now().toString() + window.crypto.getRandomValues(new Uint32Array(1))[0];

    this._shapes.push(shape);

    this.redraw();
  }

  _onShapesErasedCallback(shapes) {
    for (let i = 0; i < shapes.length; i++) {
      let deletedShape = shapes[i];

      this._shapes = this._shapes.filter((oldShape) => {
        if (deletedShape.id === oldShape.id) {
          return false;
        }

        return true;
      });
    }

    this.redraw();

    this._drawer.setConfig({
      shapes: this._shapes
    });
  }

  _onTouchMove(event) {
    if (event.touches.length > 1) {
      this._onScroll(event);
    }
  }

  _onTouchStart(event) {
    if (event.touches.length > 1) {
      this._lastDragPoint = [event.touches[0].pageX, event.touches[0].pageY];
    }
  }

  _resizeCanvas() {
    let canvasContainerEl = this._canvasElement.parentNode;

    this._canvasElement.setAttribute('height', canvasContainerEl.offsetHeight);
    this._canvasElement.setAttribute('width', canvasContainerEl.offsetWidth);
  }

  _setActiveTool() {
    if (this._drawer) {
      this._drawer.destroy();
    }

    if (this._config.activeTool === Tools.line) {
      this._drawer = new DrawLine({
        boardSize: [this._config.width, this._config.height],
        callback: this._onShapeCreatedCallback.bind(this),
        canvas: this._canvasElement,
        color: this._config.color,
        globalCompositeOperation: 'source-over',
        lineCap: 'round',
        lineJoin: 'round',
        offset: this._offset,
        size: this._getToolSize()
      });
    } else if (this._config.activeTool === Tools.eraser) {
      this._drawer = new Eraser({
        boardSize: [this._config.width, this._config.height],
        callback: this._onShapesErasedCallback.bind(this),
        canvas: this._canvasElement,
        offset: this._offset,
        shapes: this._shapes
      });
    }
  }

  _setupCanvas() {
    this._canvasElement = document.getElementById('canvas');
  }

  _setupContext() {
    this._context = this._canvasElement.getContext('2d');
  }

  _setupToolbar() {
    let config = {
      clearWhiteboardCallback: this._clearWhiteboard.bind(this),
      fullscreenCallback: this._handleFullscreen.bind(this),
      shareWhiteboardCallback: this._shareWhiteboard.bind(this),
      srcNode: 'toolbar',
      valuesCallback: this.setConfig.bind(this)
    };

    this._toolbar = new Toolbar(Object.assign(config, this._config));
  }

  _shareWhiteboard() {
    // TODO: Share the whiteboard via WeDeploy
  }

  _updateOffset(params) {
    if (params.height > params.canvasHeight && params.height - this._offset[1] < params.canvasHeight) {
      this._offset[1] += params.height - this._offset[1] - params.canvasHeight;
    }

    if (params.width > params.canvasWidth && params.width - this._offset[0] < params.canvasWidth) {
      this._offset[0] += params.width - this._offset[0] - params.canvasWidth;
    }
  }
};

export default Whiteboard;