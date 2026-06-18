/**
 * qrcode-tool.js — renders QR codes fully offline using the vendored
 * `qrcode` library (vendor/qrcode.min.js, bundled from the well-known
 * MIT-licensed npm package of the same name). No network call at runtime.
 */
(function () {
  'use strict';

  let debounceHandle = null;

  function initQrTab(root) {
    const input = root.querySelector('#qrInput');
    const canvas = root.querySelector('#qrCanvas');
    const hint = root.querySelector('#qrHint');
    const downloadBtn = root.querySelector('#qrDownloadBtn');

    function render() {
      const text = input.value;
      if (!text) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hint.style.display = 'block';
        downloadBtn.disabled = true;
        return;
      }
      window.QRCodeLib.toCanvas(canvas, text, { width: 280, margin: 2 }, function (err) {
        if (err) {
          TG.showAlert('Could not generate QR code: ' + err.message);
          downloadBtn.disabled = true;
          return;
        }
        hint.style.display = 'none';
        downloadBtn.disabled = false;
      });
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceHandle);
      debounceHandle = setTimeout(render, 150);
    });

    downloadBtn.addEventListener('click', () => {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      TG.haptic('light');
    });

    downloadBtn.disabled = true;
    render();
  }

  window.QrTool = { init: initQrTab };
})();
