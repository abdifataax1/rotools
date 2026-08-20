local EncodingService = game:GetService("EncodingService")

local Config = require(script.Parent.Config)
local VideoDecoder = {}
local HEADER_BYTES = 32

local function byteEquals(data, offset, value)
	return buffer.readu8(data, offset) == string.byte(value)
end

function VideoDecoder.Decode(compressed)
	if typeof(compressed) == "string" then
		compressed = buffer.fromstring(compressed)
	end
	if typeof(compressed) ~= "buffer" then
		error("Chunk response was not a buffer")
	end
	local decompressedSize = EncodingService:GetDecompressedBufferSize(compressed, Enum.CompressionAlgorithm.Zstd)
	if not decompressedSize or decompressedSize < HEADER_BYTES or decompressedSize > Config.MaxChunkDecompressedBytes then
		error("Invalid decompressed chunk size")
	end
	local raw = EncodingService:DecompressBuffer(compressed, Enum.CompressionAlgorithm.Zstd)
	if buffer.len(raw) ~= decompressedSize then
		error("Chunk decompression length mismatch")
	end
	if not (byteEquals(raw, 0, "R") and byteEquals(raw, 1, "V") and byteEquals(raw, 2, "F") and byteEquals(raw, 3, "1")) then
		error("Invalid frame chunk magic")
	end
	local chunk = {
		Raw = raw,
		Version = buffer.readu8(raw, 4),
		Channels = buffer.readu8(raw, 5),
		HeaderBytes = buffer.readu16(raw, 6),
		Width = buffer.readu16(raw, 8),
		Height = buffer.readu16(raw, 10),
		FPS = buffer.readu16(raw, 12) / 100,
		FrameCount = buffer.readu16(raw, 14),
		StartFrame = buffer.readu32(raw, 16),
		TotalFrameCount = buffer.readu32(raw, 20),
		FrameBytes = buffer.readu32(raw, 24),
		RawBytes = buffer.readu32(raw, 28),
	}
	local expected = chunk.HeaderBytes + chunk.FrameCount * chunk.FrameBytes
	if chunk.Version ~= 1 or chunk.Channels ~= 4 or chunk.HeaderBytes ~= HEADER_BYTES or expected ~= decompressedSize or chunk.RawBytes ~= decompressedSize then
		error("Unsupported or corrupted frame chunk")
	end
	if chunk.FrameBytes ~= chunk.Width * chunk.Height * 4 then
		error("RGBA frame size mismatch")
	end
	return chunk
end

function VideoDecoder.CopyFrame(chunk, absoluteFrame)
	local localFrame = absoluteFrame - chunk.StartFrame
	if localFrame < 0 or localFrame >= chunk.FrameCount then
		return nil
	end
	local frame = buffer.create(chunk.FrameBytes)
	buffer.copy(frame, 0, chunk.Raw, chunk.HeaderBytes + localFrame * chunk.FrameBytes, chunk.FrameBytes)
	return frame
end

return VideoDecoder
