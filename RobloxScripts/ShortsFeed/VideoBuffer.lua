local Config = require(script.Parent.Config)
local VideoDecoder = require(script.Parent.VideoDecoder)

local VideoBuffer = {}
VideoBuffer.__index = VideoBuffer

function VideoBuffer.new(metadata)
	return setmetatable({ Metadata = metadata, Chunks = {}, Order = {}, Bytes = 0 }, VideoBuffer)
end

function VideoBuffer:Add(chunkIndex, chunk)
	if self.Chunks[chunkIndex] then
		return
	end
	self.Chunks[chunkIndex] = chunk
	table.insert(self.Order, chunkIndex)
	self.Bytes += chunk.RawBytes
	while #self.Order > Config.MaxCachedChunksPerPlayer do
		local oldest = table.remove(self.Order, 1)
		local removed = self.Chunks[oldest]
		if removed then
			self.Bytes -= removed.RawBytes
			self.Chunks[oldest] = nil
		end
	end
end

function VideoBuffer:HasChunk(chunkIndex)
	return self.Chunks[chunkIndex] ~= nil
end

function VideoBuffer:GetFrame(frameIndex)
	local chunkIndex = math.floor(frameIndex / self.Metadata.chunkFrames)
	local chunk = self.Chunks[chunkIndex]
	if not chunk then
		return nil
	end
	return VideoDecoder.CopyFrame(chunk, frameIndex)
end

function VideoBuffer:GetBufferedSeconds(frameIndex)
	local frame = frameIndex
	while frame < self.Metadata.frameCount do
		local chunkIndex = math.floor(frame / self.Metadata.chunkFrames)
		if not self.Chunks[chunkIndex] then
			break
		end
		local chunkEnd = math.min(self.Metadata.frameCount, (chunkIndex + 1) * self.Metadata.chunkFrames)
		frame = chunkEnd
	end
	return math.max(0, frame - frameIndex) / self.Metadata.fps
end

function VideoBuffer:Clear()
	table.clear(self.Chunks)
	table.clear(self.Order)
	self.Bytes = 0
end

return VideoBuffer
