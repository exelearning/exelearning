import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from './toast.js';

describe('Toast utility', () => {
  let toastElement;
  let toastInstance;
  let progressContainer;
  let progressBar;
  let toastBody;
  let toastHeader;
  let toastApi;
  const originalBootstrap = global.bootstrap;

  beforeEach(() => {
    toastApi = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    const MockBootstrapToast = vi.fn(function () {
      this.show = toastApi.show;
      this.hide = toastApi.hide;
    });
    global.bootstrap = {
      Toast: MockBootstrapToast,
    };

    // Build DOM structure used by Toast
    toastElement = document.createElement('div');
    toastElement.classList.add('toast', 'hiding');

    toastHeader = document.createElement('div');
    toastHeader.className = 'toast-header';
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    const title = document.createElement('h6');
    title.className = 'toast-title';
    toastHeader.append(icon, title);

    toastBody = document.createElement('div');
    toastBody.className = 'toast-body';

    progressContainer = document.createElement('div');
    progressContainer.className = 'toast-progress-container';
    progressContainer.style.display = 'none';
    progressBar = document.createElement('div');
    progressBar.className = 'toast-progress-bar';
    progressContainer.append(progressBar);

    toastElement.append(toastHeader, toastBody, progressContainer);
    toastElement.remove = vi.fn();

    toastInstance = new Toast({}, 'toast-id', toastElement);
  });

  afterEach(() => {
    global.bootstrap = originalBootstrap;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows the progress bar and resets percentage', () => {
    toastElement.classList.add('no-progress');
    toastInstance.showProgress();

    expect(progressContainer.style.display).toBe('block');
    expect(progressBar.style.width).toBe('0%');
  });

  it('hides the progress bar when requested', () => {
    progressContainer.style.display = 'flex';
    toastInstance.hideProgress();

    expect(progressContainer.style.display).toBe('none');
  });

  it('sets progress and clamps values', () => {
    toastInstance.setProgress(45);
    expect(progressBar.style.width).toBe('45%');

    toastInstance.setProgress(150);
    expect(progressBar.style.width).toBe('100%');

    toastInstance.setProgress(-5);
    expect(progressBar.style.width).toBe('0%');
  });

  it('updates the body with progress text and percentage', () => {
    toastInstance.updateBodyWithProgress('Loading', 33.7);

    expect(toastBody.innerHTML).toBe('Loading (34%)');
    expect(progressBar.style.width).toBe('33.7%');
  });

  it('renders the provided data when shown', () => {
    const payload = {
      icon: 'check_circle',
      title: 'Complete',
      body: 'All good',
      error: true,
    };
    toastElement.classList.add('hiding');
    toastInstance.show(payload);

    expect(toastElement.classList.contains('hiding')).toBe(false);
    expect(toastHeader.querySelector('.toast-icon').innerHTML).toBe('check_circle');
    expect(toastHeader.querySelector('.toast-title').innerHTML).toBe('Complete');
    expect(toastBody.innerHTML).toBe('All good');
    expect(toastBody.classList.contains('error')).toBe(true);
    expect(toastApi.show).toHaveBeenCalled();
  });

  it('auto-removes when remove timeout is provided', () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(toastInstance, 'remove');
    toastInstance.show({ remove: 1000 });
    vi.advanceTimersByTime(1000);

    expect(removeSpy).toHaveBeenCalled();
  });

  it('hides and schedules bootstrap hide after hidingTime', () => {
    vi.useFakeTimers();
    toastBody.classList.add('error');
    toastInstance.hide();

    expect(toastElement.classList.contains('hiding')).toBe(true);
    expect(toastBody.classList.contains('error')).toBe(false);
    vi.advanceTimersByTime(toastInstance.hidingTime);

    expect(toastApi.hide).toHaveBeenCalled();
  });

  it('removes the toast element after timeout', () => {
    vi.useFakeTimers();
    toastInstance.remove();
    vi.advanceTimersByTime(toastInstance.hidingTime);

    expect(toastApi.hide).toHaveBeenCalled();
    expect(toastElement.remove).toHaveBeenCalled();
  });
});
