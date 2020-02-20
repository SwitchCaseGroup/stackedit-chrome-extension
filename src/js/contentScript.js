/* global chrome */
import Stackedit from 'stackedit-js';
import '../img/icon.svg';
import presets from './presets';
import settings from './settings';

const buttonSize = 24;
const styleContent = `
.stackedit-open-button {
  position: absolute;
  width: ${buttonSize}px;
  height: ${buttonSize}px;
  background: no-repeat url("${chrome.runtime.getURL('icon.svg')}");
  background-size: ${buttonSize}px ${buttonSize}px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.5s;
}

.stackedit-open-button:focus,
.stackedit-open-button:hover {
  opacity: 1;
}
`;

settings.getSites()
  .then((sites) => {
    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.innerHTML = styleContent;
    document.head.appendChild(styleEl);

    function decorateTextarea(el, preset) {
      if (!el.$moveStackeditButton) {
        const buttonEl = document.createElement('span');
        buttonEl.className = 'stackedit-open-button';
        buttonEl.title = 'Edit with StackEdit';
        if (el.nextSibling) {
          el.parentNode.insertBefore(buttonEl, el.nextSibling);
        } else {
          el.parentNode.appendChild(buttonEl);
        }
        buttonEl.addEventListener('click', () => {
          const stackedit = new Stackedit({
            url: chrome.runtime.getURL('frame.html'),
          });
          stackedit.on('fileChange', (file) => {
            el.value = file.content.text;
            const event = document.createEvent('Event');
            event.initEvent('input', true, true);
            el.dispatchEvent(event);
          });
          stackedit.openFile({
            name: window.location.hostname,
            content: {
              text: el.value,
              properties: preset,
            },
          });
        });
        el.$moveStackeditButton = () => {
          const rect = el.getBoundingClientRect();
          const paddingRight = parseFloat(getComputedStyle(el).getPropertyValue('padding-right'));
          const paddingBottom = parseFloat(getComputedStyle(el).getPropertyValue('padding-bottom'));
          Object.entries({
            display: !el.disabled && rect.width && rect.height ? 'block' : 'none',
            left: `${((el.offsetLeft + rect.width) - buttonSize) - paddingRight}px`,
            top: `${((el.offsetTop + rect.height) - buttonSize) - paddingBottom}px`,
          }).forEach(([key, value]) => {
            if (buttonEl.style[key] !== value) {
              buttonEl.style[key] = value;
            }
          });
        };
      }
      el.$moveStackeditButton();
    }

    function decorateAll(preset) {
      const textareaEls = document.getElementsByTagName('textarea');
      for (let i = 0; i < textareaEls.length; i += 1) {
        decorateTextarea(textareaEls[i], preset);
      }
    }

    function decorateGitHubCodeMirror(preset) {

      // Inject listeners needed to communicate with CodeMirror
      var injectedCode = `// Code here.
      document.addEventListener('stackeditCodeMirrorSetValueEvent', function (e) {
        var data = e.detail;
        let cm = document.querySelector(data.selector).CodeMirror;
        cm.setValue(data.text);
      });

      document.addEventListener('stackeditCodeMirrorGetValueEvent', function (e) {
        var data = e.detail;
        let cm = document.querySelector(data.selector).CodeMirror;
        data.text = cm.getValue();
        document.dispatchEvent(new CustomEvent(data.cb, { detail: data }));
      });
      `;
      var script = document.createElement('script');
      script.textContent = injectedCode;
      document.documentElement.appendChild(script);
      script.remove();

      // Add Button with logic to do editing
      const buttonEl = document.createElement('span');
      buttonEl.className = 'stackedit-open-button';
      buttonEl.title = 'Edit with StackEdit';
      document.querySelector("textarea.file-editor-textarea ~ div.CodeMirror").parentNode.appendChild(buttonEl);

      buttonEl.addEventListener('click', () => {
        const stackedit = new Stackedit({
          url: chrome.runtime.getURL('frame.html'),
        });
        stackedit.on('fileChange', (file) => {
          let newContents = file.content.text;
          let data = {
            selector: "textarea.file-editor-textarea ~ div.CodeMirror",
            text: newContents
          };
          document.dispatchEvent(new CustomEvent('stackeditCodeMirrorSetValueEvent', { detail: data }));
        });

        let eventData = {
          cb: `cb_${Math.floor(Math.random()*1000001)}`,
          selector: "textarea.file-editor-textarea ~ div.CodeMirror"
        };
        document.addEventListener(eventData.cb, function (e) {
          let data = e.detail;
          stackedit.openFile({
            name: window.location.hostname,
            content: {
              text: data.text,
              properties: preset,
            }
          });
        });
        document.dispatchEvent(new CustomEvent('stackeditCodeMirrorGetValueEvent', { detail: eventData }));

      });
    }

    sites.some((site) => {
      if (!window.location.href.match(site.regex)) {
        return false;
      }
      const preset = presets[site.preset];
      const observer = new MutationObserver(() => decorateAll(preset));
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
      window.addEventListener('resize', () => decorateAll(preset));
      decorateAll(preset);

      if(site.url == 'https://github.com/'){
        decorateGitHubCodeMirror(preset);
      }

      return true;
    });
  });
