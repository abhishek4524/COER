/**
 * liveSource.js — Real-Time Persona Simulation Stream
 * Connects to the Express Socket.io server per run room,
 * with fallback to MockLiveSource when VITE_USE_MOCK="true" or when offline.
 */

import { io } from 'socket.io-client';
import { allSessions } from '../mock/sessions.js';

const TICK_MS = 800;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const thoughts = [
  'Where is the checkout button?',
  'This page is taking forever…',
  'Why does clicking this do nothing?',
  'Found it! That was hidden.',
  'Is this safe to enter my card?',
  "Why is the font so small?",
  'Okay, what does this icon mean?',
  "I can't find the cart.",
  'Too many steps in checkout.',
  'This is actually really smooth!',
  'I need to call my nephew.',
  "Error? What error?",
  'Let me try clicking this instead.',
  'Loading… loading…',
  'I expected this to be bigger.',
];

const actions = [
  'Scrolling page', 'Reading headline', 'Hovering button',
  'Clicking nav link', 'Filling form', 'Searching for price',
  'Rage clicking', 'Trying to zoom', 'Reading error', 'Closing popup',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Real Socket.io Live Source ──────────────────────────────────────────────

class SocketLiveSource {
  constructor(runId) {
    this.runId = runId;
    this._handlers = {};
    this.socket = null;
    this._connected = false;
    this._sessions = {};
    this._timeoutFallback = null;
  }

  on(event, handler) {
    this._handlers[event] = handler;
    return this;
  }

  _emit(event, data) {
    if (this._handlers[event]) this._handlers[event](data);
  }

  start() {
    try {
      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        this._connected = true;
        console.log(`[SocketLiveSource] Connected to server, joining room run:${this.runId}`);
        this.socket.emit('join:run', this.runId);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[SocketLiveSource] Connect error, falling back to mock:', err.message);
        this._startMockFallback();
      });

      // ── Event: run:started ──
      this.socket.on('run:started', (data) => {
        this._emit('runStarted', data);
      });

      // ── Event: session:started ──
      this.socket.on('session:started', (data) => {
        const id = data.sessionId || data.personaName;
        this._sessions[id] = {
          id,
          personaId: data.personaId || id,
          name: data.personaName || 'Tester',
          avatar: data.personaAvatar || '/assets/personas/default.png',
          color: '#6C63FF',
          expression: 'neutral',
          frustration: 10,
          currentStepIndex: 0,
        };

        this._emit('personaUpdate', {
          sessionId: id,
          personaId: id,
          persona: {
            name: data.personaName || 'Tester',
            avatar: data.personaAvatar || '/assets/personas/default.png',
            color: '#6C63FF',
            status: 'active',
          },
          expression: 'neutral',
          frustration: 10,
          action: 'Started testing…',
          currentStep: { label: 'Starting test', duration: 1 },
          stepIndex: 0,
          isComplete: false,
          status: 'active',
        });
      });

      // ── Event: step ──
      this.socket.on('step', (data) => {
        const id = data.sessionId || data.personaName;
        const color = '#6C63FF';
        const isRageClick = data.action === 'rage_click' || (data.frustration >= 70 && data.action === 'click');

        // Emit cursor movement
        if (data.x != null && data.y != null) {
          this._emit('cursorMove', {
            personaId: id,
            name: data.personaName || 'Tester',
            color,
            x: data.x,
            y: data.y,
            isRageClick,
          });
        }

        // Emit live thought
        if (data.thought) {
          this._emit('thought', {
            personaId: id,
            name: data.personaName || 'Tester',
            avatar: data.personaAvatar || '/assets/personas/default.png',
            fallbackAvatar: `https://api.dicebear.com/8.x/thumbs/svg?seed=${id}`,
            text: data.thought,
            variant: data.frustration > 50 ? 'friction' : 'default',
          });
        }

        // Emit persona tile update
        this._emit('personaUpdate', {
          sessionId: id,
          personaId: id,
          persona: {
            name: data.personaName || 'Tester',
            avatar: data.personaAvatar || '/assets/personas/default.png',
            color,
            status: 'active',
          },
          expression: data.emotion || 'neutral',
          frustration: data.frustration || 0,
          action: data.action ? `${data.action.toUpperCase()} ${data.target || ''}` : 'Interacting…',
          currentStep: {
            screenshot: data.screenshotUrl || '/assets/steps/product.png',
            label: data.action,
            duration: 2,
          },
          stepIndex: data.stepIndex || 0,
          isComplete: false,
          status: 'active',
        });
      });

      // ── Event: emotion ──
      this.socket.on('emotion', (data) => {
        const id = data.sessionId || data.personaName;
        this._emit('personaUpdate', {
          sessionId: id,
          personaId: id,
          persona: {
            name: data.personaName || 'Tester',
            avatar: data.personaAvatar || '/assets/personas/default.png',
            color: '#6C63FF',
            status: 'active',
          },
          expression: data.emotion || 'neutral',
          frustration: data.frustration || 0,
          isComplete: false,
        });
      });

      // ── Event: session:finished ──
      this.socket.on('session:finished', (data) => {
        const id = data.sessionId || data.personaName;
        const isConverted = data.outcome === 'completed';
        this._emit('personaUpdate', {
          sessionId: id,
          personaId: id,
          persona: {
            name: data.personaName || 'Tester',
            status: isConverted ? 'converted' : 'abandoned',
          },
          expression: isConverted ? 'happy' : 'frustrated',
          frustration: data.frustrationScore || 50,
          action: isConverted ? 'Goal Completed ✓' : 'Gave Up ✗',
          isComplete: true,
          status: isConverted ? 'converted' : 'abandoned',
        });
      });

      // ── Event: run:finished ──
      this.socket.on('run:finished', (data) => {
        console.log(`[SocketLiveSource] Run ${this.runId} finished:`, data);
        this._emit('runComplete', { runId: this.runId, summary: data.summary });
      });

    } catch (err) {
      console.warn('[SocketLiveSource] Failed to init socket, using mock fallback:', err.message);
      this._startMockFallback();
    }

    return this;
  }

  _startMockFallback() {
    if (this._mockSource) return;
    this._mockSource = new MockLiveSource(this.runId);
    Object.keys(this._handlers).forEach(event => {
      this._mockSource.on(event, this._handlers[event]);
    });
    this._mockSource.start();
  }

  stop() {
    if (this.socket) {
      this.socket.emit('leave:run', this.runId);
      this.socket.disconnect();
      this.socket = null;
    }
    if (this._mockSource) {
      this._mockSource.stop();
      this._mockSource = null;
    }
  }
}

// ─── Mock Live Source ────────────────────────────────────────────────────────

class MockLiveSource {
  constructor(runId) {
    this.runId = runId;
    this._handlers = {};
    this._interval = null;
    this._tick = 0;
    this._sessions = allSessions.map(s => ({
      ...s,
      currentStepIndex: 0,
      cursorX: rand(50, 700),
      cursorY: rand(50, 400),
      expression: 'neutral',
      frustration: 10,
      isComplete: false,
    }));
  }

  on(event, handler) {
    this._handlers[event] = handler;
    return this;
  }

  _emit(event, data) {
    if (this._handlers[event]) this._handlers[event](data);
  }

  start() {
    this._interval = setInterval(() => {
      this._tick++;
      const active = this._sessions.filter(s => !s.isComplete);

      if (active.length === 0) {
        this._emit('runComplete', { runId: this.runId });
        this.stop();
        return;
      }

      // Pick 3-6 random personas to update this tick
      const toUpdate = active
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(active.length, rand(3, 6)));

      toUpdate.forEach(session => {
        const maxSteps = session.steps.length;

        // Advance step occasionally
        if (this._tick % rand(6, 12) === 0 && session.currentStepIndex < maxSteps - 1) {
          session.currentStepIndex++;
        }

        const currentStep = session.steps[session.currentStepIndex] ?? session.steps[0];

        // Move cursor
        session.cursorX = Math.max(10, Math.min(760, session.cursorX + rand(-40, 40)));
        session.cursorY = Math.max(10, Math.min(480, session.cursorY + rand(-30, 30)));

        // Update frustration
        const isStuck = session.persona.status !== 'converted';
        session.frustration = Math.min(
          100,
          session.frustration + (isStuck ? rand(0, 4) : rand(-1, 1))
        );

        // Update expression
        if (session.frustration > 80) session.expression = pick(['angry', 'frustrated']);
        else if (session.frustration > 55) session.expression = pick(['confused', 'frustrated']);
        else if (session.persona.status === 'converted') session.expression = pick(['focused', 'happy', 'neutral']);
        else session.expression = pick(['neutral', 'confused']);

        // Check if done
        if (session.currentStepIndex >= maxSteps - 1 && this._tick % rand(20, 30) === 0) {
          session.isComplete = true;
        }

        const isRageClick = session.frustration > 70 && Math.random() < 0.15;

        this._emit('personaUpdate', {
          sessionId: session.id,
          personaId: session.personaId,
          persona: session.persona,
          expression: session.expression,
          frustration: session.frustration,
          action: pick(actions),
          currentStep: currentStep,
          stepIndex: session.currentStepIndex,
          isComplete: session.isComplete,
          status: session.isComplete ? session.persona.status : 'active',
        });

        this._emit('cursorMove', {
          personaId: session.personaId,
          name: session.persona.name,
          color: session.persona.color,
          x: session.cursorX,
          y: session.cursorY,
          isRageClick,
        });

        if (Math.random() < 0.12) {
          this._emit('thought', {
            personaId: session.personaId,
            name: session.persona.name,
            avatar: session.persona.avatar,
            fallbackAvatar: `https://api.dicebear.com/8.x/thumbs/svg?seed=${session.personaId}`,
            text: pick(thoughts),
            variant: session.frustration > 60 ? 'friction' : 'default',
          });
        }
      });
    }, TICK_MS);

    return this;
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export const createLiveSource = (runId) => {
  if (USE_MOCK || !runId || runId.startsWith('mock-')) {
    return new MockLiveSource(runId || 'mock-run');
  }
  return new SocketLiveSource(runId);
};
