# Multi Photobooth Roblox Plugin

This is a local Studio plugin inspired by the UI in your screenshots.

## What It Does

- Adds a `RoTools > Multi Photobooth` toolbar button.
- Reads your current Studio selection.
- Shows one card per selected `Model` or `BasePart`.
- Provides Camera controls: presets, yaw, pitch, FOV, brightness, pan X, pan Y.
- Provides Effects controls: outline, shadow, inner shadow, colors, thickness-style controls.
- `Capture All` refreshes the selected model previews.
- `Export All` creates icon parts under `Workspace/_MultiPhotoboothExports`.
- Each exported icon is a flat part with a `SurfaceGui > ImageLabel`.
- When your Studio version supports it, the plugin uses `ViewportFrame:CaptureSnapshotAsync()` and stores the captured content on the ImageLabel. It also attempts to create an `EditableImage`.

## Install

1. In Roblox Studio, open the `Plugins` tab.
2. Open `Plugins Folder`.
3. Copy `MultiPhotoboothPlugin.lua` into that folder.
4. Restart Studio.
5. Click `RoTools > Multi Photobooth`.

Alternative for testing:

1. Open Plugin Debugging in Studio.
2. Create a plugin script.
3. Paste the contents of `MultiPhotoboothPlugin.lua`.
4. Run it.

## Notes

Roblox Studio plugins cannot silently upload image assets to your account. This plugin creates Studio objects you can inspect and reuse. If `CaptureSnapshotAsync` and `EditableImage` are available in your Studio build, the exported ImageLabel receives the captured icon content. Otherwise, the export still creates the organized icon objects and settings attributes, but Studio may require you to capture/upload manually.

For normal inventory UI, use the exported `ImageLabel` as the template once the image content is available or uploaded.
