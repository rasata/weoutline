import BrowserHelper from '../helpers/browser-helper';
import CryptHelper from '../helpers/crypt-helper';
import Data from '../data/data';
import Draw from '../draw/draw';
import DrawHelper from '../helpers/draw-helper';
import DrawLine from '../draw/draw-line';
import EraseWhiteboardModal from './erase-whiteboard';
import Eraser from '../draw/eraser';
import Map from '../map/map';
import ShareWhiteboardModal from './share-whiteboard';
import ToolbarTools from '../toolbar/toolbar-tools';
import ToolbarUser from '../toolbar/toolbar-user';
import ToolbarZoom from '../toolbar/toolbar-zoom';
import Tools from '../draw/tools';
import { ShapeType } from '../draw/shape';

class Whiteboard {
  constructor(config) {
    config = config || {};

    this._config = config;

    this._shapes = [];

    this._loadSpinner = document.getElementById(this._config.whiteboard.loadSpinnerId);
    this._whiteboardId = this._config.whiteboard.id;
    this._sessionId = this._generateSessionId();

    this._fetchState();

    this._setupCanvas();
    this._setupContext();
    this._setupData();
    this._setupMap();
    this._setupToolbarTools();
    this._setupToolbarUser();
    this._setupToolbarZoom();

    this._attachListeners();

    this._resizeCanvas();
    this._setScale();

    this._setActiveTool();

    this._fetchShapes()
      .then((shapes) => {
        this._shapes = shapes || [];
        this.redraw();
        this._loadSpinner.classList.add('hidden');
      });

    if (this._whiteboardId) {
      this._data.watchShapes(this._whiteboardId, this._sessionId, {
        onShapeCreated: this._onShapeCreatedRemotelyCallback.bind(this),
        onShapeErased: this._onShapeErasedRemotelyCallback.bind(this),
        onShapeWatchError: this._onShapeWatchError.bind(this)
      });
    }
  }

  addShapes(shapes) {
    this._shapes = this._addShapesToCollection(this._shapes, shapes);

    this._saveShapes(this._whiteboardId, shapes);
  }

  deleteShapes(shapes) {
    this._shapes = this._removeShapesFromCollection(this._shapes, shapes);

    this._deleteShapes(this._whiteboardId, shapes);
  }

  destroy() {
    if (this._drawer) {
      this._drawer.destroy();
    }

    this._toolbarTools.destroy();
    this._map.destroy();

    this._detachListeners();

    window.clearTimeout(this._saveStateTimeout);

    this._data.destroy();
  }

  drawRulers() {
    this._drawHorizontalRuler();

    this._drawVerticalRuler();
  }

  drawShapes() {
    let canvasSize = {
      height: this._canvasElement.height,
      width: this._canvasElement.width
    };

    for (let i = 0; i < this._shapes.length; i++) {
      if (this._shapes[i].type === ShapeType.LINE) {
        if (DrawHelper.checkPointsInViewport(this._shapes[i].points, this._offset, this._scale, canvasSize)) {
          let points = this._shapes[i].points.map((point) => {
            return DrawHelper.getPointWithOffset(point, this._offset);
          });

          Draw.line(points, this._context, {
            color: this._shapes[i].color,
            globalCompositeOperation: 'source-over',
            lineCap: 'round',
            lineJoin: 'round',
            lineWidth: DrawHelper.getPixelScaledNumber(this._shapes[i].lineWidth)
          });
        }
      }
    }
  }

  redraw() {
    this._context.clearRect(0, 0, this._context.canvas.width/this._scale, this._context.canvas.height/this._scale);

    this.drawRulers();

    this.drawShapes();

    this._map.draw(this._shapes);
  }

  _addShapesToCollection(shapesList, shapes) {
    return shapesList.concat(shapes);
  }

  _applyZoom(zoomPoint, zoom) {
    let zoomPointX = zoomPoint[0];
    let zoomPointY = zoomPoint[1];

    this._context.scale(zoom, zoom);

    this._offset[0] = ((zoomPointX / this._scale) + this._offset[0]) - (zoomPointX / (this._scale * zoom));
    this._offset[1] = ((zoomPointY / this._scale) + this._offset[1]) - (zoomPointY / (this._scale * zoom));

    this._scale *= zoom;

    this._drawer.setConfig({
      offset: this._offset,
      scale: this._scale
    });

    this._map.setConfig({
      offset: this._offset,
      scale: this._scale
    });

    this._toolbarZoom.setValues({
      scale: this._scale
    });

    this.redraw();

    this._saveStateWithTimeout(this._whiteboardId);
  }

  _attachListeners() {
    this._onTouchStartListener = this._onTouchStart.bind(this);
    this._onTouchMoveListener = this._onTouchMove.bind(this);
    this._onWheelListener = this._onScroll.bind(this);
    this._onContextMenuListener = function(e) { e.preventDefault(); };
    this._resizeListener = this._onResize.bind(this);
    this._orientationChangeListener = () => {setTimeout(this._onResize.bind(this), 100);};
    this._onFullscreenChangeListener = this._onFullscreenChange.bind(this);

    if (BrowserHelper.getTouchEventsSupport()) {
      this._canvasElement.addEventListener('touchstart', this._onTouchStartListener, { passive: true });
      this._canvasElement.addEventListener('touchmove', this._onTouchMoveListener);
    } else {
      this._canvasElement.addEventListener('wheel', this._onWheelListener);
      this._canvasElement.addEventListener('contextmenu', this._onContextMenuListener);
    }

    document.addEventListener(BrowserHelper.getFullscreenChangeEventName(this._canvasElement), this._onFullscreenChangeListener);

    window.addEventListener('orientationchange', this._orientationChangeListener);
    window.addEventListener('resize', this._resizeListener);
  }

  _clearWhiteboard() {
    if (!this._eraseWhiteboardModal) {
      this._eraseWhiteboardModal = new EraseWhiteboardModal({
        srcNode: 'eraseWhiteboard',
        eraseWhiteBoardCallback: () => {
          this.deleteShapes(this._shapes);

          this._resetState();
        }
      });
    }

    this._eraseWhiteboardModal.show();
  }

  _decreaseZoomCallback() {
    let scaleMultiplier = (this._scale - 0.1) / this._scale;
    let tmpScale = this._scale * scaleMultiplier;

    if (tmpScale < 0.1 || tmpScale > 10) {
      return;
    }

    let viewportMidPoint = [this._canvasElement.width / this._scale / 2, this._canvasElement.height / this._scale / 2];

    this._applyZoom(viewportMidPoint, scaleMultiplier);
  }

  _increaseZoomCallback() {
    let scaleMultiplier = (this._scale + 0.1) / this._scale;
    let tmpScale = this._scale * scaleMultiplier;

    if (tmpScale < 0.1 || tmpScale > 10) {
      return;
    }

    let viewportMidPoint = [this._canvasElement.width / this._scale / 2, this._canvasElement.height / this._scale / 2];

    this._applyZoom(viewportMidPoint, scaleMultiplier);
  }

  _normalizeZoomCallback() {
    this._resetState();
  }

  _detachListeners() {
    document.removeEventListener(BrowserHelper.getFullscreenChangeEventName(this._canvasElement), this._onFullscreenChangeListener);
    this._canvasElement.removeEventListener('contextmenu', this._onContextMenuListener);
    this._canvasElement.removeEventListener('touchmove', this._onTouchMoveListener);
    this._canvasElement.removeEventListener('touchstart', this._onTouchStartListener, { passive: true });
    this._canvasElement.removeEventListener('wheel', this._onWheelListener);
    window.removeEventListener('orientationchange', this._orientationChangeListener);
    window.removeEventListener('resize', this._resizeListener);
  }

  _deleteShapes(whiteboard, shapes) {
    if (this._whiteboardId) {
      this._deleteShapesOnWhiteboard(whiteboard, shapes);
    } else {
      this._deleteShapesLocally(shapes);
    }
  }

  _deleteShapesLocally(shapes) {
    let localShapes = JSON.parse(localStorage.getItem('shapes')) || [];
    localShapes = this._removeShapesFromCollection(localShapes, shapes);
    localStorage.setItem('shapes', JSON.stringify(localShapes));
  }

  _deleteShapesOnWhiteboard(whiteboardId, shapes) {
    this._data.deleteShapes(whiteboardId, shapes)
      .then(() => {
        console.log('Shapes deleted successfully on whiteboard', whiteboardId);
      })
      .catch((error) => {
        alert('Deleting the shapes failed!');
        console.error(error);
      });
  }

  _drawHorizontalRuler() {
    let posY = this._offset[1] < 0 ? Math.abs(this._offset[1]) : 0;

    for (let i = 0; i <= this._config.whiteboard.width; i += 20) {
      this._context.beginPath();
      this._context.strokeStyle = '#000000';
      this._context.lineWidth = 1;
      this._context.moveTo(i - this._offset[0], posY);

      if (i % 100 === 0) {
        this._context.lineTo(i - this._offset[0], posY + 10);
      } else {
        this._context.lineTo(i - this._offset[0], posY + 5);
      }
      this._context.stroke();

      if (i % 500 === 0 && i > 0) {
        this._context.strokeStyle = '#000000';
        this._context.textAlign = i + 20 < this._config.whiteboard.width ? 'center' : 'end';
        this._context.textBaseline = 'alphabetic';
        this._context.font = this._config.whiteboard.rulerFontSize + 'px';
        this._context.fillStyle = '#000000';
        this._context.fillText(i, i - this._offset[0], posY + 20);
      }
    }
  }

  _drawVerticalRuler() {
    let posX = this._offset[0] < 0 ? Math.abs(this._offset[0]) : 0;

    for (let i = 20; i <= this._config.whiteboard.height; i += 20) {
      this._context.beginPath();
      this._context.strokeStyle = '#000000';
      this._context.lineWidth = 1;
      this._context.moveTo(posX, i - this._offset[1]);

      if (i % 100 === 0) {
        this._context.lineTo(posX + 10, i - this._offset[1]);
      } else {
        this._context.lineTo(posX + 5, i - this._offset[1]);
      }
      this._context.stroke();

      if (i % 500 === 0) {
        this._context.strokeStyle = '#000000';
        this._context.textAlign = 'start';
        this._context.textBaseline = i + 20 < this._config.whiteboard.height ? 'middle' : 'bottom';
        this._context.font = this._config.whiteboard.rulerFontSize + 'px';
        this._context.fillStyle = '#000000';
        this._context.fillText(i, posX + 12, i - this._offset[1]);
      }
    }
  }

  _enableZoomModeCallback(data) {
    this._zoomModeEnabled = data.zoomModeEnabled;
  }

  _fetchShapes() {
    if (this._whiteboardId) {
      return this._data.fetchShapes(this._whiteboardId);
    } else {
      return new Promise((resolve) => {
        let localShapes = JSON.parse(localStorage.getItem('shapes'));

        resolve(localShapes);
      });
    }
  }

  _fetchState() {
    let offset;
    let scale;

    if (this._whiteboardId) {
      offset = localStorage.getItem(this._whiteboardId + '_' + 'offset');
      scale = localStorage.getItem(this._whiteboardId + '_' + 'scale');
    } else {
      offset = localStorage.getItem('offset');
      scale = localStorage.getItem('scale');
    }

    this._offset = JSON.parse(offset) || [0, 0];
    this._scale = JSON.parse(scale) || 1;
  }

  _generateSessionId() {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
  }

  _generateWhiteboardId() {
    return CryptHelper.getRandomBase64(12);
  }

  _getAllowedOffset(scrollData) {
    let tmpOffsetWidth = this._offset[0] + scrollData[0];
    let tmpOffsetHeight = this._offset[1] + scrollData[1];

    let allowedOffset = [];

    if ((scrollData[0] < 0 && tmpOffsetWidth < 0) ||
      (scrollData[0] > 0 && tmpOffsetWidth + this._canvasElement.width > this._config.whiteboard.width)) {
      allowedOffset[0] = 0;
    } else {
      allowedOffset[0] = scrollData[0];
    }

    if ((scrollData[1] < 0 && tmpOffsetHeight < 0) ||
      (scrollData[1] > 0 && tmpOffsetHeight + this._canvasElement.height > this._config.whiteboard.height)) {
      allowedOffset[1] = 0;
    } else {
      allowedOffset[1] = scrollData[1];
    }

    return allowedOffset;
  }

  _getLineWidth() {
    let lineWidth;

    if (this._config.whiteboard.activeTool === Tools.line) {
      lineWidth = this._config.whiteboard.penSize;
    }

    return lineWidth;
  }

  _getShareWhiteboardData() {
    let data;
    let whiteboardBookmark;
    let whiteboardId = this._whiteboardId || this._generateWhiteboardId();

    let url = window.location.origin + '/wb/' + whiteboardId;

    if (this._config.whiteboard.currentUser && this._whiteboardId) {
      return this._data.getWhiteboardBookmark(this._config.whiteboard.currentUser.id, this._whiteboardId)
        .then((data) => {
          whiteboardBookmark = data ? data[0] : null;

          if (whiteboardBookmark) {
            data = {
              action: 'logged user + existing bookmark',
              url: url,
              whiteboardBookmark: whiteboardBookmark,
              whiteboardId: whiteboardId
            };
          } else {
            data = {
              action: 'logged user + new bookmark',
              url: url,
              whiteboardId: whiteboardId
            };
          }

          return data;
        });
    } else {
      if (this._config.whiteboard.currentUser) {
        data = {
          action: 'logged user + new bookmark',
          url: url,
          whiteboardId: whiteboardId
        };
      } else if (this._whiteboardId) {
        data = {
          action: 'anonymous user + existing whiteboard',
          url: url,
          whiteboardId: whiteboardId
        };
      } else {
        data = {
          action: 'anonymous user + new whiteboard',
          url: url,
          whiteboardId: whiteboardId
        };
      }

      return Promise.resolve(data);
    }
  }

  _getShareWhiteboardModal() {
    if (!this._shareWhiteboardModal) {
      this._shareWhiteboardModal = new ShareWhiteboardModal({
        srcNode: 'shareWhiteboard'
      });
    }

    return this._shareWhiteboardModal;
  }

  _handleFullscreen() {
    let mainContainerNode = document.getElementById(this._config.whiteboard.mainContainer);

    let inFullscreen = BrowserHelper.getFullScreenModeValue();

    if (inFullscreen) {
      BrowserHelper.exitFullscreen(mainContainerNode);
    } else {
      BrowserHelper.requestFullscreen(mainContainerNode);
    }
  }

  _onFullscreenChange() {
    let values = this._toolbarTools.getValues();

    values.fullscreen = BrowserHelper.getFullScreenModeValue();

    this._toolbarTools.setValues(values);
  }

  _onMapSetOffsetCallback(point) {
    let canvasHeight = this._canvasElement.height / this._scale;
    let canvasWidth = this._canvasElement.width / this._scale;

    let x = point[0] - canvasWidth / 2;
    let y = point[1] - canvasHeight / 2;

    if (this._scale >= 1) {
      if (x + canvasWidth > this._config.whiteboard.width) {
        x = this._config.whiteboard.width - canvasWidth;
      } else if (x < 0) {
        x = 0;
      }

      if (y + canvasHeight > this._config.whiteboard.height) {
        y = this._config.whiteboard.height - canvasHeight;
      } else if (y < 0) {
        y = 0;
      }
    }

    this._offset[0] = x;
    this._offset[1] = y;

    this.redraw();

    this._saveState(this._whiteboardId);
  }

  _onResize() {
    let canvasSize = this._resizeCanvas();

    this._setScale();

    this._updateOffset({
      canvasHeight: canvasSize.height,
      canvasWidth: canvasSize.width,
      height: this._config.whiteboard.height,
      width: this._config.whiteboard.width
    });

    this.redraw();
  }

  _onScroll(event) {
    event.preventDefault();

    if (event.deltaMode === 0) {
      if (this._zoomModeEnabled) {
        let mouseX = event.offsetX;
        let mouseY = event.offsetY;

        let wheel = event.wheelDelta / 120;

        let zoom = 1 - wheel/2;

        let tmpScale = this._scale * zoom;

        if (tmpScale < 0.1 || tmpScale > 10) {
          return;
        }

        this._applyZoom([mouseX, mouseY], zoom);
      } else {
        let allowedOffset = this._getAllowedOffset([event.deltaX, event.deltaY]);

        this._offset[0] += allowedOffset[0];
        this._offset[1] += allowedOffset[1];

        this.redraw();

        this._saveStateWithTimeout(this._whiteboardId);
      }
    } else if (event.touches.length > 1) {
      if (!this._dragModeSet) {
        this._setDragMode(event);
      } else if (this._dragMode === 'pan') {
        this._onPan(event);
      } else {
        this._onZoom(event);
      }
    }
  }

  _onPan(event) {
    let curPoint = [event.touches[0].pageX, event.touches[0].pageY];

    let allowedOffset = this._getAllowedOffset([
      (curPoint[0] - this._lastPoint0[0]) * -1,
      (curPoint[1] - this._lastPoint0[1]) * -1
    ]);

    this._offset[0] += allowedOffset[0];
    this._offset[1] += allowedOffset[1];

    this._drawer.setConfig({
      offset: this._offset
    });

    this._map.setConfig({
      offset: this._offset
    });

    this.redraw();

    this._saveStateWithTimeout(this._whiteboardId);

    this._lastPoint0[0] = curPoint[0];
    this._lastPoint0[1] = curPoint[1];
  }

  _onShapeCreatedLocallyCallback(shape) {
    // change points coordinates according to 0,0
    shape.points = shape.points.map((point) => {
      return DrawHelper.getPointWithoutOffset(point, this._offset);
    });

    shape.id = CryptHelper.getId();

    shape.sessionId = this._sessionId;

    this.addShapes([shape]);
    this.redraw();
  }

  _onShapeCreatedRemotelyCallback(shape) {
    this._shapes = this._addShapesToCollection(this._shapes, [shape]);

    if (this._config.whiteboard.activeTool === Tools.eraser) {
      this._drawer.setConfig({
        shapes: this._shapes
      });
    }

    this.redraw();
  }

  _onShapeErasedRemotelyCallback(shape) {
    this._shapes = this._removeShapesFromCollection(this._shapes, [shape]);

    this.redraw();

    if (this._config.whiteboard.activeTool === Tools.eraser) {
      this._drawer.setConfig({
        shapes: this._shapes
      });
    }
  }

  _onShapeWatchError(error) {
    alert('On shape watch error ' + error.message);
  }

  _onShapesErasedLocallyCallback(shapes) {
    this.deleteShapes(shapes);
    this.redraw();

    if (this._config.whiteboard.activeTool === Tools.eraser) {
      this._drawer.setConfig({
        shapes: this._shapes
      });
    }
  }

  _onShareWhiteboardCallback() {
    let shareWhiteboardModal = this._getShareWhiteboardModal();
    shareWhiteboardModal.show();

    this._getShareWhiteboardData()
      .then((data) => {
        shareWhiteboardModal.setConfig({
          shareWhiteBoardCallback: (payload) => {
            this._shareWhiteboard({
              createWhiteboardBookmark: payload.createBookmark,
              id: data.whiteboardBookmark ? data.whiteboardBookmark.id : null,
              saveShapes: !this._whiteboardId,
              whiteboardId: payload.whiteboardId,
              whiteboardName: payload.whiteboardName
            });

            if (!this._whiteboardId) {
              this._whiteboardId = payload.whiteboardId;

              this._data.watchShapes(this._whiteboardId, this._sessionId, {
                onShapeCreated: this._onShapeCreatedRemotelyCallback.bind(this),
                onShapeErased: this._onShapeErasedRemotelyCallback.bind(this),
                onShapeWatchError: this._onShapeWatchError.bind(this)
              });
            }
          }
        });

        shareWhiteboardModal.setData(data);
      })
      .catch((error) => {
        alert('Error retrieving whiteboard bookmark');
        console.error(error);
        shareWhiteboardModal.hide();
      });
  }

  _onTouchMove(event) {
    if (event.touches.length > 1) {
      this._onScroll(event);
    }
  }

  _onTouchStart(event) {
    if (event.touches.length > 1) {
      this._dragModeSet = false;

      if (this._zoomModeEnabled) {
        this._dragModeSet = true;
        this._dragMode = 'zoom';
      }

      this._lastPoint0 = [event.touches[0].pageX, event.touches[0].pageY];
      this._lastPoint1 = [event.touches[1].pageX, event.touches[1].pageY];
    }
  }

  _onUserSignInCallback(href) {
    href += '?returnURL=' + encodeURIComponent(location.href);
    location.href = href;
  }

  _onZoom(event) {
    let curPoint0 = [event.touches[0].pageX, event.touches[0].pageY];
    let curPoint1 = [event.touches[1].pageX, event.touches[1].pageY];

    let curDistance = DrawHelper.getPointsDistance(curPoint0, curPoint1);
    let lastDistance = DrawHelper.getPointsDistance(this._lastPoint0, this._lastPoint1);

    let scaleMultiplier = 0;

    if (Math.abs(curDistance - lastDistance) >= 3) {
      if (curDistance > lastDistance) {
        scaleMultiplier = (this._scale + 0.1) / this._scale;
      } else if (curDistance < lastDistance) {
        scaleMultiplier = (this._scale - 0.1) / this._scale;
      }
    }

    if (scaleMultiplier !== 0) {
      let tmpScale = this._scale * scaleMultiplier;

      if (tmpScale < 0.1 || tmpScale > 10) {
        return;
      }

      let zoomPoint = DrawHelper.getMidPoint(curPoint0, curPoint1);

      this._applyZoom(zoomPoint, scaleMultiplier);
    }

    this._lastPoint0 = curPoint0;
    this._lastPoint1 = curPoint1;
  }

  _removeShapesFromCollection(shapesList, shapes) {
    return shapesList.filter((curShape) => {
      for (let i = 0; i < shapes.length; i++) {
        let deletedShape = shapes[i];

        if (deletedShape.id === curShape.id) {
          return false;
        }
      }

      return true;
    });
  }

  _resetState() {
    this._context.setTransform(1, 0, 0, 1, 0, 0);

    this._offset[0] = 0;
    this._offset[1] = 0;
    this._scale = 1;

    this._saveState(this._whiteboardId);

    this._drawer.setConfig({
      offset: this._offset,
      scale: this._scale
    });

    this._map.setConfig({
      offset: this._offset,
      scale: this._scale
    });

    this._toolbarZoom.setValues({
      scale: this._scale
    });

    this.redraw();
  }

  _resizeCanvas() {
    let canvasContainerEl = this._canvasElement.parentNode;

    let canvasSize = {
      height: canvasContainerEl.offsetHeight,
      width: canvasContainerEl.offsetWidth
    };

    this._canvasElement.setAttribute('height', canvasSize.height);
    this._canvasElement.setAttribute('width', canvasSize.width);

    return canvasSize;
  }

  _saveState(whiteboardId) {
    if (whiteboardId) {
      localStorage.setItem(whiteboardId + '_' + 'offset', JSON.stringify(this._offset));
      localStorage.setItem(whiteboardId + '_' + 'scale', JSON.stringify(this._scale));
    } else {
      localStorage.setItem('offset', JSON.stringify(this._offset));
      localStorage.setItem('scale', JSON.stringify(this._scale));
    }
  }

  _saveStateWithTimeout(whiteboardId) {
    window.clearTimeout(this._saveStateTimeout);

    this._saveStateTimeout = window.setTimeout(() => {
      this._saveState(whiteboardId);
    }, 300);
  }

  _saveShapes(whiteboardId, shapes) {
    if (this._whiteboardId) {
      this._saveShapesOnWhiteboard(this._whiteboardId, shapes);
    } else {
      this._saveShapesLocally(shapes);
    }
  }

  _saveShapesOnWhiteboard(whiteboardId, shapes) {
    this._data.saveShapes(whiteboardId, shapes)
      .then(() => {
        console.log('Shapes saved successfully on whiteboard', this._whiteboardId);
      })
      .catch((error) => {
        alert('Creating whiteboard and saving shapes failed!');
        console.error(error);
      });
  }

  _saveShapesLocally(shapes) {
    let localShapes = JSON.parse(localStorage.getItem('shapes')) || [];
    localShapes = localShapes.concat(shapes);
    localStorage.setItem('shapes', JSON.stringify(localShapes));
  }

  _setActiveTool() {
    if (this._drawer) {
      this._drawer.destroy();
    }

    if (this._config.whiteboard.activeTool === Tools.line) {
      this._drawer = new DrawLine({
        boardSize: [this._config.whiteboard.width, this._config.whiteboard.height],
        callback: this._onShapeCreatedLocallyCallback.bind(this),
        canvas: this._canvasElement,
        color: this._config.whiteboard.color,
        globalCompositeOperation: 'source-over',
        lineCap: 'round',
        lineJoin: 'round',
        lineWidth: this._getLineWidth(),
        minPointDistance: this._config.whiteboard.minPointDistance,
        offset: this._offset,
        scale: this._scale
      });
    } else if (this._config.whiteboard.activeTool === Tools.eraser) {
      this._drawer = new Eraser({
        boardSize: [this._config.whiteboard.width, this._config.whiteboard.height],
        callback: this._onShapesErasedLocallyCallback.bind(this),
        canvas: this._canvasElement,
        offset: this._offset,
        scale: this._scale,
        shapes: this._shapes
      });
    }
  }

  _setDragMode(event) {
    let curPoint0 = [event.touches[0].pageX, event.touches[0].pageY];
    let curPoint1 = [event.touches[1].pageX, event.touches[1].pageY];

    if (Math.abs(curPoint0[0] - this._lastPoint0[0]) >= 10 || Math.abs(curPoint0[1] - this._lastPoint0[1]) >= 10 ||
      Math.abs(curPoint1[0] - this._lastPoint1[0]) >= 10 || Math.abs(curPoint1[1] - this._lastPoint1[1]) >= 10) {

      this._dragModeSet = true;

      if ((curPoint0[0] < this._lastPoint0[0] && curPoint1[0] < this._lastPoint1[0]) ||
          (curPoint0[0] > this._lastPoint0[0] && curPoint1[0] > this._lastPoint1[0]) ||
        (curPoint0[1] < this._lastPoint0[1] && curPoint1[1] < this._lastPoint1[1]) ||
        (curPoint0[1] > this._lastPoint0[1] && curPoint1[1] > this._lastPoint1[1])) {
          this._dragMode = 'pan';
        } else {
          this._dragMode = 'zoom';
        }
      }
  }

  _setToolValues(toolValues) {
    Object.assign(this._config.whiteboard, toolValues);

    this._setActiveTool();
  }

  _setScale() {
    this._context.scale(this._scale, this._scale);
  }

  _setupCanvas() {
    this._canvasElement = document.getElementById(this._config.whiteboard.srcNode);
  }

  _setupContext() {
    this._context = this._canvasElement.getContext('2d');
  }

  _setupData() {
    this._data = new Data({
      url: this._config.whiteboard.dataURL
    });
  }

  _setupMap() {
    this._map = new Map({
      color: this._config.map.color,
      container: this._config.map.container,
      height: this._config.map.height,
      lineWidth: this._config.map.lineWidth,
      offset: this._offset,
      scale: this._scale,
      setOffsetCallback: this._onMapSetOffsetCallback.bind(this),
      srcCanvas: this._canvasElement,
      srcNode: this._config.map.srcNode,
      width: this._config.map.width
    });
  }

  _setupToolbarTools() {
    let config = {
      clearWhiteboardCallback: this._clearWhiteboard.bind(this),
      fullscreenCallback: this._handleFullscreen.bind(this),
      shareWhiteboardCallback: this._onShareWhiteboardCallback.bind(this),
      valuesCallback: this._setToolValues.bind(this)
    };

    Object.assign(config, this._config.toolbarTools);

    this._toolbarTools = new ToolbarTools(config);
  }

  _setupToolbarUser() {
    let config = {
      currentUser: this._config.whiteboard.currentUser,
      signInCallback: this._onUserSignInCallback.bind(this),
      signOutCallback: this._config.whiteboard.signOutCallback
    };

    Object.assign(config, this._config.toolbarUser);

    this._toolbarUser = new ToolbarUser(config);
  }

  _setupToolbarZoom() {
    let config = {
      decreaseZoomCallback: this._decreaseZoomCallback.bind(this),
      enableZoomModeCallback: this._enableZoomModeCallback.bind(this),
      increaseZoomCallback: this._increaseZoomCallback.bind(this),
      normalizeZoomCallback: this._normalizeZoomCallback.bind(this),
      scale: this._scale
    };

    Object.assign(config, this._config.toolbarZoom);

    this._toolbarZoom = new ToolbarZoom(config);
  }

  _shareWhiteboard(params) {
    if (params.saveShapes) {
      history.pushState(null, null, window.location.origin + '/wb/' + params.whiteboardId);

      if (this._shapes.length) {
        this._data.saveShapes(params.whiteboardId, this._shapes)
          .then(() => {
            console.log('Shapes saved successfully on whiteboard', params.whiteboardId);
          })
          .catch((error) => {
            alert('Creating whiteboard and saving shapes failed!');
            console.error(error);
          });
      }

      this._saveState(this._whiteboardId);
    }

    if (params.createWhiteboardBookmark) {
      this._data.createOrUpdateWhiteboardBookmark({
        id: params.id,
        userId: this._config.whiteboard.currentUser.id,
        whiteboardName: params.whiteboardName,
        whiteboardId: params.whiteboardId
      });
    }
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