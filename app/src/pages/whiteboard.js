require('../assets/whiteboard/structure.scss');
require('../assets/whiteboard/skin.scss');

import Tools from '../draw/tools';
import Whiteboard from '../whiteboard/whiteboard';

window.addEventListener('load', () => {
  let auth = WeDeploy.auth('auth.weoutline.wedeploy.io');

  let whiteboard;

  function createWhiteboard() {
    let whiteboardSize = {
      height: 3000,
      width: 3000
    };

    let activeTool = Tools.line;
    let color = '#000000';
    let mapHidden = true;
    let penSize = 4;

    whiteboard = new Whiteboard({
      map: {
        color: color,
        container: 'mapContainer',
        height: whiteboardSize.height,
        lineWidth: 1,
        mapHidden: mapHidden,
        srcNode: 'map',
        width: whiteboardSize.width
      },
      toolbarTools: {
        activeTool: activeTool,
        color: color,
        fullscreen: false,
        mapHidden: mapHidden,
        penSize: penSize,
        srcNode: 'toolbarTools'
      },
      toolbarUser: {
        currentUser: auth.currentUser,
        srcNode: 'toolbarUser'
      },
      toolbarZoom: {
        srcNode: 'toolbarZoom'
      },
      whiteboard: {
        activeTool: activeTool,
        color: color,
        currentUser: auth.currentUser,
        dataURL: 'data.weoutline.wedeploy.io',
        height: whiteboardSize.height,
        id: getWhiteboardId(),
        loadSpinnerId: 'loadSpinner',
        mainContainer: 'mainContainer',
        minPointDistance: 3,
        penSize: penSize,
        rulerFontSize: 10,
        signOutCallback: userSignOut,
        srcNode: 'canvas',
        width: whiteboardSize.width
      }
    });
  }

  function getWhiteboardId() {
    let whiteboardURLRegex = /\/wb\/([a-zA-Z0-9-_]*)$/;

    let match = whiteboardURLRegex.exec(document.location);

    if (match) {
      return match[1];
    }
  }

  function userSignOut() {
    auth.signOut()
      .then(() => {
        location.reload();
      });
  }

  window.onpopstate = () => {
    if (whiteboard) {
      whiteboard.destroy();
    }

    createWhiteboard();
  };

  createWhiteboard();
}, {
  once: true
});