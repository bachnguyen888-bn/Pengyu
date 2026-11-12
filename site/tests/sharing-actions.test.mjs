// The browser share boundary: prepare the complete, previewed payload before a tap; send it once;
// cancellation and unsupported browsers never trigger a second share or silently copy anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postcardPayload, sharePreview } from '../js/pengyu/invite.js';

const image = () => new File([new Uint8Array([137, 80, 78, 71])], 'pengyu-postcard.png', { type: 'image/png' });
const text = 'Week complete with Pengu.';

test('an image share checks and sends the complete image-and-text payload shown in the preview', async () => {
  const file = image();
  const checked = [];
  const sent = [];
  const api = { canShare: (data) => { checked.push(data); return true; }, share: async (data) => { sent.push(data); } };
  const payload = postcardPayload(text, file, api);
  assert.deepEqual(payload, { files: [file], text });
  assert.equal(checked.length, 1);
  assert.equal(checked[0], payload, 'support check is for the same complete payload');
  assert.equal(sent.length, 0, 'preparing a preview shares nothing');
  const result = sharePreview(payload, api);
  assert.equal(sent.length, 1, 'the browser receives the tap synchronously, before awaiting anything');
  assert.equal(sent[0], payload, 'no hidden text, URL or different image is added');
  assert.equal(await result, 'shared');
});

test('a browser rejecting image plus text gets an explicit text-only payload, even if it accepts a file alone', () => {
  const file = image();
  const api = { canShare: (data) => !('text' in data) };
  assert.deepEqual(postcardPayload(text, file, api), { text });
  assert.deepEqual(postcardPayload(text, file, {}), { text }, 'no image-share API');
  assert.deepEqual(postcardPayload(text, null, api), { text }, 'drawing not available');
  assert.deepEqual(postcardPayload(text, file, { canShare() { throw new TypeError('unsupported'); } }), { text });
});

test('cancelling a share sends once and does not retry with text or report success', async () => {
  let calls = 0;
  const payload = { files: [image()], text };
  const api = { share: async (data) => { calls++; assert.equal(data, payload); throw new DOMException('Cancelled', 'AbortError'); } };
  assert.equal(await sharePreview(payload, api), 'cancelled');
  assert.equal(calls, 1);
});

test('unsupported and denied share sheets return a fallback state without changing or sending extra data', async () => {
  const payload = { text };
  assert.equal(await sharePreview(payload, {}), 'unsupported');
  let calls = 0;
  assert.equal(await sharePreview(payload, { share() { calls++; throw new DOMException('Denied', 'NotAllowedError'); } }), 'failed');
  assert.equal(calls, 1);
  assert.deepEqual(payload, { text });
});
