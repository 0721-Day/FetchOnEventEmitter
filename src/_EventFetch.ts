export interface EventFetchApis {
    "EFetch:RTCManager:Auth": [
      { token: string },
      { success: boolean; message: string }
    ];
  }