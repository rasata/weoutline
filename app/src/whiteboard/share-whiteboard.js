import Copy from '../copy/copy';

class ShareWhiteboardModal {
  constructor(config) {
    this._config = config;

    this._setupContainer();
  }

  destroy() {
    this._detachListeners();
  }

  hide() {
    this._detachListeners();
    this._element.classList.add('hidden');

    this._resetDialog();
  }

  setData(data) {
    this._data = data;

    let content = this._renderContent(data);

    this._initContent(content);

    this._shareDashboardSpinner.classList.add('hidden');
  }

  setConfig(config) {
    Object.assign(this._config, config);
  }

  show() {
    this._attachListeners();
    this._element.classList.remove('hidden');
  }

  _attachListeners() {
    this._hideClickListener = this.hide.bind(this);
    this._onKeyDownListener = this._onKeyDown.bind(this);

    document.addEventListener('keydown', this._onKeyDownListener);
    this._hideBtn.addEventListener('click', this._hideClickListener);
  }

  _detachListeners() {
    document.removeEventListener('keydown', this._onKeyDownListener);
    this._hideBtn.removeEventListener('click', this._hideClickListener);
  }

  _initContent(content) {
    this._shareWhiteboardTitle.innerHTML = content.title;
    this._shareWhiteboardForm.innerHTML = content.form;
    this._shareWhiteboardFooterBtnContainer.innerHTML = content.footer;

    let shareWhiteboardButton = this._shareWhiteboardFooterBtnContainer.querySelector('#shareWhiteboardButton');

    if (shareWhiteboardButton) {
      shareWhiteboardButton.addEventListener('click', this._shareWhiteboard.bind(this));
    }

    if (this._copy) {
      this._copy.destroy();
    }

    this._copy = new Copy({
      srcNode: '#shareWhiteboardCopyURL',
      targetEl: '#shareWhiteboardURL'
    });
  }

  _renderContent(payload) {
    if (payload.action === 'logged user + new bookmark') {
      return {
        title: `Share whiteboard`,
        form:
          `<label for="url">URL</label>
          <div class="share-whiteboard-url-container">
            <input id="shareWhiteboardURL" class="share-whiteboard-url-input" name="url" type="text" placeholder="URL" value="${payload.url}" required readonly>
            <button id="shareWhiteboardCopyURL" class="btn share-whiteboard-url-btn copy">
              <span class="icon icon-clipboard"></span>
            </button>
          </div>

          <div class="separator"></div>

          <div id="shareWhiteboardNameContainer">
            <div class="add-name-container">
              <input id="shareWhiteboardAddName" type="checkbox" checked>
              <label for="shareWhiteboardAddName">Save bookmark on my dashboard</label>
            </div>

            <label for="name">Name</label>
            <input id="shareWhiteboardName" class="share-whiteboard-name" name="name" type="text" placeholder="Name" value="New whiteboard" required autofocus>
          </div>`,
        footer: `<button id="shareWhiteboardButton" class="btn">Share</button>`
      };
    } else if (payload.action === 'logged user + existing bookmark') {
      return {
        title: 'Update bookmark',
        form:
          `<div id="shareWhiteboardMessage" class="share-whiteboard-message">This whiteboard is already bookmarked. Change the name and click on "Update" button to save the changes.
          </div>

          <div class="separator"></div>

          <div id="shareWhiteboardNameContainer">
            <label for="name">URL</label>
            <div class="share-whiteboard-url-container">
              <input id="shareWhiteboardURL" class="share-whiteboard-url-input" name="url" type="text" placeholder="URL" value="${payload.url}" required readonly>
              <button id="shareWhiteboardCopyURL" class="btn share-whiteboard-url-btn copy">
                <span class="icon icon-clipboard"></span>
              </button>
            </div>
          </div>

          <div class="separator"></div>

          <label for="name">Name</label>
          <input id="shareWhiteboardName" class="share-whiteboard-name" name="name" type="text" placeholder="Name" value="${payload.whiteboardBookmark.whiteboardName}" required autofocus>`,
        footer: `<button id="shareWhiteboardButton" class="btn">Update</button>`
      };
    }

    throw new Error('Invalid state');
  }

  _onKeyDown(event) {
    if (event.keyCode === 13) {
      this._shareWhiteboard();
    } else if (event.keyCode === 27) {
      this.hide();
    }
  }

  _resetDialog() {
    this._shareWhiteboardTitle.innerHTML = 'Loading...';
    this._shareWhiteboardForm.innerHTML = '';
    this._shareWhiteboardFooterBtnContainer.innerHTML = '';
    this._shareDashboardSpinner.classList.remove('hidden');
  }

  _setupContainer() {
    this._element = document.getElementById(this._config.srcNode);

    this._shareDashboardSpinner = this._element.querySelector('#shareDashboardSpinner');
    this._shareWhiteboardFooterBtnContainer = this._element.querySelector('#shareWhiteboardFooterBtnContainer');
    this._shareWhiteboardForm = this._element.querySelector('#shareWhiteboardForm');
    this._shareWhiteboardTitle = this._element.querySelector('#shareWhiteboardTitle');

    this._hideBtn = this._element.querySelector('#shareWhiteboardHide');
  }

  _shareWhiteboard() {
    let payload;

    if (this._data.action === 'logged user + new bookmark') {
      payload = {
        createBookmark: this._shareWhiteboardForm.querySelector('#shareWhiteboardAddName').checked,
        whiteboardId: this._data.whiteboardId,
        whiteboardName: this._shareWhiteboardForm.querySelector('#shareWhiteboardName').value
      };
    } else if (this._data.action === 'logged user + existing bookmark') {
      payload = {
        createBookmark: true,
        whiteboardId: this._data.whiteboardId,
        whiteboardName: this._shareWhiteboardForm.querySelector('#shareWhiteboardName').value
      };
    }

    this._config.shareWhiteboardCallback(payload);

    this.hide();
  }
}

export default ShareWhiteboardModal;