# Roblox external-frame Shorts proof of concept

## Result

Milestone 1 works in the connected `tttesttttt` Studio place without `VideoFrame` assets:

```text
owned local MP4
  -> FFmpeg crop/resize/30 FPS RGBA extraction
  -> 15-frame RVF1 chunks
  -> Node Zstandard compression and immutable HTTP endpoints
  -> Roblox server HttpService proxy/cache
  -> client EncodingService Zstandard decompression
  -> buffer frame copy
  -> EditableImage:WritePixelsBuffer()
  -> ImageLabel.ImageContent
```

The implementation also includes a three-slot previous/current/next feed, preloading, automatic advance, mouse wheel, large image arrows, click/tap pause, mobile swipe, optimistic likes, searchable comments with Roblox usernames, Invite Friends, synchronized Roblox audio, a thin visual-only progress bar, vertical transitions, camera entry/exit, bounded chunk caches, minimal error UI, and a Studio-only debug overlay.

The main feed contains no creator name, avatar, username, caption, description, hashtags, song title, playback time, duration text, or remaining-time text.

## Phase 0 audit

- Existing architecture: RoTools React/Vite frontend and Express ESM backend.
- Roblox structure: two legacy paste-in `ComputerShorts` scripts existed locally; the connected place was a baseplate with no game scripts.
- Backend: `server/index.js` on port 5174, previously used for RoTools/Open Cloud helpers.
- Camera system: none in the connected place.
- Networking: one legacy RemoteEvent in paste-in source only; none in the connected place.
- Rojo/Wally: neither was present.
- Build system: npm, Vite, Express; no tests before this work.
- MCP: a live Roblox Studio bridge was connected to `tttesttttt` and used for sync, play tests, input, console inspection, and screen capture.
- Reuse decision: the Express server and MCP connection were reused. The legacy `VideoFrame`/caption UI was not wired into the new system because it conflicts with the experiment.

## Source layout

```text
server/shorts/
  config.js
  frameChunk.js
  processor.js
  ingest.js
  router.js
  EngagementStore.js
  rateLimiter.js
  videoIds.js
  providers/LocalVideoProvider.js
  providers/LocalFeedProvider.js
  *.test.js

RobloxScripts/ShortsFeed/
  Config.lua
  Types.lua
  NumberFormatter.lua
  VideoApiClient.lua
  VideoDecoder.lua
  VideoBuffer.lua
  CustomVideoPlayer.lua
  CameraController.lua
  UIFactory.lua
  ShortsServer.server.lua
  ShortsClient.client.lua
```

The Studio place contains:

```text
ReplicatedStorage/ShortsFeed/<ModuleScripts>
ServerScriptService/ShortsServer
StarterPlayer/StarterPlayerScripts/ShortsClient
Workspace/ShortsSystem/Screen
Workspace/ShortsSystem/CameraPoint
Workspace/ShortsSystem/Screen/WatchShorts
```

## Install, run, and ingest

```powershell
npm install
npm run dev:server
npm run ingest -- .\videos\your-owned-clip.mp4 clip-id
npm test
npm run build
```

`ffmpeg-static` and `ffprobe-static` are development dependencies, so a separate system FFmpeg install is not required. To use system binaries instead, set `FFMPEG_PATH` and `FFPROBE_PATH`.

The default backend API is `http://127.0.0.1:5174/shorts`. It exposes:

- `GET /health`
- `GET /feed?playerId=...`
- `GET /video/:id/metadata?playerId=...`
- `GET /video/:id/chunk/:chunkIndex`
- `POST /video/:id/like`
- `DELETE /video/:id/like`
- `GET /video/:id/comments`
- `POST /video/:id/comments`

Likes and comments are deliberately in-memory for this proof of concept. Replace `EngagementStore` with persistent storage before production.

## Roblox Studio setup

1. Enable **Game Settings > Security > Allow HTTP Requests**.
2. For a published experience, enable **Allow Mesh / Image APIs**. Roblox currently requires the owner to meet its age/ID verification requirements for this setting.
3. Keep `Config.BackendUrl` on `http://127.0.0.1:5174/shorts` only for local Studio tests.
4. For a published game, deploy the backend behind public HTTPS and change `Config.BackendUrl` to that origin.
5. Move/rotate `Workspace.ShortsSystem.CameraPoint` in Studio. Its CFrame is the camera's exact feed position and orientation.
6. Move/resize `Workspace.ShortsSystem.Screen` as desired. The prompt is parented to the screen.
7. Play, approach the screen, and press E. In Studio, F toggles entry/exit.

Camera entry saves CameraType, CameraSubject, CFrame, Focus, and field of view; changes to Scriptable; tweens to CameraPoint; and temporarily sinks movement controls. Exit stops all three players, clears decoded buffers, tweens back, restores the saved camera state, and re-enables controls. Character respawn and deletion of `ShortsSystem` trigger best-effort restore paths.

## Inputs and development controls

- Mouse wheel down/up: next/previous.
- Down/Up arrow: next/previous.
- N/B: next/previous development aliases.
- Large image arrows: previous/next.
- Click or tap the video: pause/resume.
- Swipe up/down: next/previous; action-button touches are excluded.
- P: pause/resume.
- R: retry current clip.
- D: toggle debug overlay.
- X: clear/reload the three client slots.
- F: enter/exit in Studio.
- Escape or Q: exit where the platform does not consume the key.

For slow/failure testing, set `Workspace.ShortsSimulateNetworkDelay` to a delay in seconds or set `Workspace.ShortsSimulateRequestFailure` to true from the Studio command bar. Clear the attributes afterward. The retry/skip UI remains available and Next still works.

## Frame format

Each `.rvz` file is one Zstandard frame containing an uncompressed RVF1 header followed by 10 RGBA8 frames. The 32-byte little-endian header contains magic/version/channels/header size, width, height, FPS×100, frame count, first frame, total frames, bytes per frame, and total decompressed bytes.

The client validates all of these fields and rejects decompressed chunks above 16 MiB. No Base64 is used. The only per-frame allocation is the exact 181,760-byte RGBA buffer required by `WritePixelsBuffer` because that API accepts a full image buffer, not a subrange.

## Measured proof

Two controlled, locally generated 12-second MP4s were ingested and played in Studio:

| Measurement | Result |
| --- | ---: |
| Output resolution | 160×284 |
| Target FPS | 10 |
| Observed FPS after navigation | 9.6 |
| Observed dropped frames | 2 in the captured playback window |
| Observed buffered duration | 3.1 s |
| Observed HTTP chunk latency | 80 ms |
| Observed Zstd decode time | 3.3 ms |
| Observed EditableImage write | 0.1 ms |
| Frames per chunk | 10 |
| Raw RGBA chunk size | 1,817,632 bytes including header |
| Clip 1 average compressed chunk | 193,286 bytes |
| Clip 2 average compressed chunk | 91,603 bytes |
| Combined controlled average | 142,027 bytes (138.7 KiB) |

The two clips produced 3,418,659 compressed bytes for 24 seconds of video, or about 142 KB/s / 1.14 Mbit/s in this highly compressible test material. This must not be treated as a real-world upper bound; noisy camera footage can compress much worse and trend toward the 1.82 MB/s raw RGBA rate.

The required RGB theoretical calculation is:

```text
160 × 284 × 3 × 10 = 1,363,200 bytes/s = 10.91 Mbit/s
```

Actual EditableImage input is RGBA:

```text
160 × 284 × 4 × 10 = 1,817,600 bytes/s = 14.54 Mbit/s
```

## Memory observations

- Three EditableImages contain about 533 KiB of raw pixel storage before engine overhead.
- A decoded 10-frame chunk is about 1.73 MiB. The four-chunk cap is about 6.93 MiB per slot and 20.8 MiB across three fully populated slots, although previous/next normally retain only their start buffer.
- The Roblox server compressed-chunk cache is capped at 32 MiB.
- During 60 rapid transitions, Studio LuaHeap rose from about 715.9 MiB to 721.8 MiB and plateaued rather than adding another similar amount in the second 30-transition batch. The absolute numbers are dominated by Studio/plugins and are not representative of a published client; this only supports the bounded-recycling observation.
- A published-device F9 memory profile and a 100+ real-clip soak test are still required.

## Bandwidth and scale

If each player requires a distinct controlled-average stream, backend/client transfer is approximately:

| Concurrent players | Controlled average | Raw RGBA worst case before transport compression |
| ---: | ---: | ---: |
| 1 | 0.142 MB/s (1.14 Mbit/s) | 1.82 MB/s (14.54 Mbit/s) |
| 10 | 1.42 MB/s (11.4 Mbit/s) | 18.2 MB/s (145 Mbit/s) |
| 100 | 14.2 MB/s (114 Mbit/s) | 182 MB/s (1.45 Gbit/s) |
| 1,000 | 142 MB/s (1.14 Gbit/s) | 1.82 GB/s (14.5 Gbit/s) |

The Roblox server cache means players in one server watching the same clip can share backend downloads, but the server still has to relay frame data to every client. Across many Roblox servers or personalized/distinct clips, backend outbound approaches the table above.

Roblox documents 500 non-Open-Cloud external HTTP requests per minute per game server. At one 1-second chunk per distinct active stream, about eight distinct continuous streams consume that quota before feed, metadata, engagement, retries, and other game traffic. Larger chunks reduce request count but increase latency and memory. This is one of the primary production blockers.

## Current Roblox constraints

- `HttpService` external requests run on the server, not LocalScripts, so the server proxy is mandatory.
- Non-Open-Cloud HTTP is limited to 500 requests/minute per game server.
- `EditableImage` allocation is subject to a device-specific memory budget and can return nil.
- Published experiences need the Mesh/Image API setting and verification requirements.
- `Content.fromObject(editableImage)` object references do not replicate usefully, so each client creates its own EditableImage.
- Large/recurrent RemoteEvent or RemoteFunction traffic costs client/server CPU and bandwidth even when the backend stream is shared.
- Invite Friends should be tested in a published multiplayer experience; Studio may report it unavailable.
- Audio is synchronized through a Roblox audio asset ID stored in each video's metadata. Roblox cannot play an arbitrary local MP4 audio track directly, so upload that audio to Roblox first and pass its asset ID during ingestion.
- A localhost URL works only for Studio on the development machine; production requires public HTTPS.

Official references:

- [HttpService](https://create.roblox.com/docs/reference/engine/classes/HttpService)
- [EditableImage](https://create.roblox.com/docs/reference/engine/classes/EditableImage)
- [AssetService.CreateEditableImage](https://create.roblox.com/docs/reference/engine/classes/AssetService)
- [EncodingService Zstandard compression](https://create.roblox.com/docs/reference/engine/classes/EncodingService)
- [ImageLabel.ImageContent](https://create.roblox.com/docs/reference/engine/classes/ImageLabel/ImageContent)
- [Content object replication warning](https://create.roblox.com/docs/reference/engine/datatypes/Content)
- [Camera customization](https://create.roblox.com/docs/workspace/camera)
- [SocialService Invite Friends](https://create.roblox.com/docs/reference/engine/classes/SocialService)
- [Experience security settings](https://create.roblox.com/docs/studio/experience-settings)

## Known gaps

- Engagement is not persistent.
- Only controlled test patterns were measured; real owned camera footage must be profiled.
- Mobile swipe code is implemented but needs physical-device validation.
- Invite Friends needs a published-experience test.
- The debug FPS is an end-to-end rendered-frame average and includes initial buffering; a later captured playback window reached 9.6 FPS.
- Server-to-client large-buffer behavior needs multi-client network profiling.
- A production backend needs authentication, durable storage, CDN/object storage, observability, moderation for comments, and stronger distributed rate limiting.

## Feasibility verdict

**YES, WITH MAJOR LIMITATIONS.**

The external MP4 -> backend -> HTTP -> Roblox buffer -> EditableImage path is real and works at 160×284 / approximately 10 FPS for 12-second controlled clips. It can support a small experimental Shorts experience without uploading every clip as a Roblox video asset. It is not yet a credible high-scale TikTok replacement: server-only HTTP, the 500-request limit, client relay bandwidth, editable-memory budgets, absence of audio, and uncertain compression on real footage are major constraints.
