import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type RecordingStatus = 'idle' | 'recording' | 'analysing' | 'done';

interface UiState {
  recordingStatus: RecordingStatus;
  recordingDurationSec: number;
  lastCheckinId: string | null;
}

const initialState: UiState = {
  recordingStatus: 'idle',
  recordingDurationSec: 0,
  lastCheckinId: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setRecordingStatus: (state, action: PayloadAction<RecordingStatus>) => {
      state.recordingStatus = action.payload;
    },
    setRecordingDuration: (state, action: PayloadAction<number>) => {
      state.recordingDurationSec = action.payload;
    },
    setLastCheckinId: (state, action: PayloadAction<string | null>) => {
      state.lastCheckinId = action.payload;
    },
    resetRecording: (state) => {
      state.recordingStatus = 'idle';
      state.recordingDurationSec = 0;
    },
  },
});

export const {
  setRecordingStatus,
  setRecordingDuration,
  setLastCheckinId,
  resetRecording,
} = uiSlice.actions;

export default uiSlice.reducer;
