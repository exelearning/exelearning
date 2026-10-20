import { beforeEach, describe, expect, it } from 'vitest';

window.eXeLearning = global.eXeLearning;
require('./exe_effects.js');

const timelineMarkup = `
  <div class="fx-timeline-container">
    <div class="fx-timeline-major">
      <h2 class="fx-timeline-marker">Section</h2>
      <div class="fx-timeline-minor">
        <h3 id="event-1"><a href="#" class="closed">Event 1</a></h3>
        <div id="event-1EX" class="fx-timeline-event">Content 1</div>
      </div>
    </div>
    <button class="fx-timeline-expand" type="button">Show</button>
  </div>
`;

async function initializeTimelinerTwice() {
  $.timeliner({ baseSpeed: 0, speed: 0 });
  $.timeliner({ baseSpeed: 0, speed: 0 });

  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Timeliner repeated initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = timelineMarkup;
  });

  it('does not stack minor heading click handlers', async () => {
    await initializeTimelinerTwice();

    $('.fx-timeline-minor h3').trigger('click');

    expect($('.fx-timeline-minor h3 a').hasClass('open')).toBe(true);
    expect($('.fx-timeline-minor h3 a').hasClass('closed')).toBe(false);
  });

  it('does not stack marker click handlers', async () => {
    await initializeTimelinerTwice();

    $('.fx-timeline-marker').trigger('click');

    expect($('.fx-timeline-minor h3 a').hasClass('open')).toBe(true);
    expect($('.fx-timeline-minor h3 a').hasClass('closed')).toBe(false);
  });

  it('does not stack expand button click handlers', async () => {
    await initializeTimelinerTwice();

    $('.fx-timeline-expand').trigger('click');

    expect($('.fx-timeline-expand').hasClass('expanded')).toBe(true);
    expect($('.fx-timeline-expand').text()).toBe('Hide');
  });
});
