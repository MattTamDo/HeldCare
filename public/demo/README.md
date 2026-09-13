# Demo clips

The three recorded windows on `/monitor` look for these files:

```
clip-1.mp4   → Room 201
clip-2.mp4   → Room 202
clip-3.mp4   → Room 203
```

Drop your videos here with those names and they load automatically on page
open. Any missing file is fine — that window just shows "No clip loaded" and
you can pick a file with **Upload clip** instead, which works for any local
video without copying it into the repo.

Notes:

- MP4 (H.264) is the safest format for Chrome.
- Clips are analysed in clip time, so detection is unaffected by how fast
  inference runs.
- Video files are gitignored; only this README is committed.
