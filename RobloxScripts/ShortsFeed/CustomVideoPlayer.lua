local AssetService = game:GetService("AssetService")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")

local Config = require(script.Parent.Config)
local Types = require(script.Parent.Types)
local VideoApiClient = require(script.Parent.VideoApiClient)
local VideoBuffer = require(script.Parent.VideoBuffer)
local VideoDecoder = require(script.Parent.VideoDecoder)

local State = Types.PlaybackState
local CustomVideoPlayer = {}
CustomVideoPlayer.__index = CustomVideoPlayer

function CustomVideoPlayer.new(imageLabel)
	local self = setmetatable({}, CustomVideoPlayer)
	self.ImageLabel = imageLabel
	self.State = State.Idle
	self.Generation = 0
	self.CurrentTime = 0
	self.LastRenderedFrame = -1
	self.RequestedPlay = false
	self.Fetching = {}
	self.Metrics = { Dropped = 0, RenderMs = 0, DecodeMs = 0, DownloadedBytes = 0, HttpMs = 0 }
	self.StateChanged = Instance.new("BindableEvent")
	self.Ended = Instance.new("BindableEvent")
	self.VideoFrame = Instance.new("VideoFrame")
	self.VideoFrame.Name = "NativeVideo"
	self.VideoFrame.BackgroundColor3 = Color3.new(0, 0, 0)
	self.VideoFrame.BorderSizePixel = 0
	self.VideoFrame.Size = UDim2.fromScale(1, 1)
	self.VideoFrame.ZIndex = imageLabel.ZIndex + 1
	self.VideoFrame.Looped = false
	self.VideoFrame.Playing = false
	self.VideoFrame.Volume = Config.AudioVolume or 0.65
	self.VideoFrame.Visible = false
	self.VideoFrame.Parent = imageLabel
	self.Sound = Instance.new("Sound")
	self.Sound.Name = "ShortsAudio"
	self.Sound.Volume = Config.AudioVolume or 0.65
	self.Sound.Looped = Config.AudioLooped == true
	self.Sound.Parent = SoundService
	self.Connection = RunService.RenderStepped:Connect(function()
		self:_step()
	end)
	return self
end

function CustomVideoPlayer:_syncSound(shouldPlay)
	if not self.Sound or self.Sound.SoundId == "" then return end
	if math.abs(self.Sound.TimePosition - self.CurrentTime) > 0.18 then
		pcall(function() self.Sound.TimePosition = self.CurrentTime end)
	end
	if shouldPlay and not self.Sound.IsPlaying then
		self.Sound:Play()
		pcall(function() self.Sound.TimePosition = self.CurrentTime end)
	elseif not shouldPlay and self.Sound.IsPlaying then
		self.Sound:Pause()
	end
end

function CustomVideoPlayer:_setState(state)
	if self.State ~= state then
		self.State = state
		self.StateChanged:Fire(state)
	end
end

function CustomVideoPlayer:_ensureImage(metadata)
	if self.EditableImage and self.EditableImage.Size == Vector2.new(metadata.width, metadata.height) then
		self.ImageLabel.ImageContent = Content.fromObject(self.EditableImage)
		return
	end
	if self.EditableImage then
		self.ImageLabel.ImageContent = Content.none
		self.EditableImage:Destroy()
	end
	self.EditableImage = AssetService:CreateEditableImage({ Size = Vector2.new(metadata.width, metadata.height) })
	if not self.EditableImage then
		error("EditableImage allocation failed; enable Mesh/Image APIs and check the client memory budget")
	end
	self.ImageLabel.ImageContent = Content.fromObject(self.EditableImage)
end

function CustomVideoPlayer:Load(metadata)
	self.Generation += 1
	local generation = self.Generation
	self.RequestedPlay = false
	self.CurrentTime = 0
	self.LastRenderedFrame = -1
	self.Metadata = metadata
	self.Sound:Stop()
	self.Sound.SoundId = ""
	self.VideoFrame:Pause()
	self.VideoFrame.Video = ""
	self.VideoFrame.Visible = false
	self.NativeMode = false
	if self.Buffer then self.Buffer:Clear() end
	self.Buffer = nil
	self.Buffer = VideoBuffer.new(metadata)
	self.Metrics = { Dropped = 0, Rendered = 0, RenderMs = 0, DecodeMs = 0, DownloadedBytes = 0, HttpMs = 0 }
	self.PlaybackStarted = nil
	table.clear(self.Fetching)
	self:_setState(State.Loading)
	local nativeVideo = tostring(metadata.videoAssetId or metadata.robloxVideo or "")
	if nativeVideo ~= "" then
		self.NativeMode = true
		self.Buffer = nil
		self.NativeStart = math.max(0, tonumber(metadata.startTime or metadata.start) or 0)
		self.NativeEnd = tonumber(metadata.endTime or metadata["end"])
		if not self.NativeEnd then self.NativeEnd = self.NativeStart + math.max(0, tonumber(metadata.duration) or 0) end
		self.NativeDuration = math.max(0, self.NativeEnd - self.NativeStart)
		self.NativeLoadStarted = os.clock()
		self.NativeSeekTarget = self.NativeStart
		self.VideoFrame.Video = nativeVideo
		self.VideoFrame.TimePosition = self.NativeStart
		self.VideoFrame.Visible = true
		return
	end
	self.Sound.SoundId = tostring(metadata.audioAssetId or (Config.AudioByVideo and Config.AudioByVideo[metadata.id]) or "")
	local ok, message = pcall(function()
		self:_ensureImage(metadata)
	end)
	if not ok then
		self.Error = tostring(message)
		self:_setState(State.Error)
		return
	end
	self:_requestChunk(0, generation)
end

function CustomVideoPlayer:_requestChunk(chunkIndex, generation)
	if not self.Metadata or chunkIndex < 0 or chunkIndex >= self.Metadata.chunkCount or self.Fetching[chunkIndex] or self.Buffer:HasChunk(chunkIndex) then
		return
	end
	self.Fetching[chunkIndex] = true
	task.spawn(function()
		local started = os.clock()
		local ok, compressed = pcall(function()
			return VideoApiClient:GetChunk(self.Metadata.id, chunkIndex)
		end)
		local httpMs = (os.clock() - started) * 1000
		if generation ~= self.Generation then
			return
		end
		self.Fetching[chunkIndex] = nil
		if not ok then
			self.Error = tostring(compressed)
			self:_setState(State.Error)
			return
		end
		local decodeStarted = os.clock()
		local decodedOk, chunk = pcall(VideoDecoder.Decode, compressed)
		self.Metrics.DecodeMs = (os.clock() - decodeStarted) * 1000
		self.Metrics.HttpMs = httpMs
		self.Metrics.DownloadedBytes += buffer.len(compressed)
		if not decodedOk or chunk.Width ~= self.Metadata.width or chunk.Height ~= self.Metadata.height then
			self.Error = decodedOk and "Chunk dimensions do not match metadata" or tostring(chunk)
			self:_setState(State.Error)
			return
		end
		self.Buffer:Add(chunkIndex, chunk)
		if self.State == State.Loading then
			self:_setState(State.Paused)
		end
	end)
end

function CustomVideoPlayer:_maintainBuffer()
	if not self.Metadata or not self.Buffer then
		return
	end
	local frameIndex = math.min(self.Metadata.frameCount - 1, math.floor(self.CurrentTime * self.Metadata.fps))
	local buffered = self.Buffer:GetBufferedSeconds(frameIndex)
	local target = self.RequestedPlay and Config.TargetBufferSeconds or Config.StartBufferSeconds
	if buffered < target then
		local chunkIndex = math.floor(frameIndex / self.Metadata.chunkFrames)
		while chunkIndex < self.Metadata.chunkCount do
			if not self.Buffer:HasChunk(chunkIndex) then
				if not self.Fetching[chunkIndex] then
					self:_requestChunk(chunkIndex, self.Generation)
				end
				break
			end
			chunkIndex += 1
		end
	end
end

function CustomVideoPlayer:_renderFrame(frameIndex)
	local pixels = self.Buffer:GetFrame(frameIndex)
	if not pixels then
		return false
	end
	local started = os.clock()
	self.EditableImage:WritePixelsBuffer(Vector2.zero, Vector2.new(self.Metadata.width, self.Metadata.height), pixels)
	self.Metrics.RenderMs = (os.clock() - started) * 1000
	if self.LastRenderedFrame >= 0 and frameIndex > self.LastRenderedFrame + 1 then
		self.Metrics.Dropped += frameIndex - self.LastRenderedFrame - 1
	end
	self.LastRenderedFrame = frameIndex
	self.Metrics.Rendered += 1
	return true
end

function CustomVideoPlayer:_step()
	if not self.Metadata or self.State == State.Idle or self.State == State.Error or self.State == State.Ended then
		return
	end
	if self.NativeMode then
		if self.State == State.Loading then
			if self.VideoFrame.IsLoaded then
				-- Keep a requested seek when a native video finishes loading. This lets
				-- the world screen freeze on the exact frame where the player left.
				self.NativeSeekTarget = self.NativeStart + math.clamp(self.CurrentTime, 0, self.NativeDuration)
				self.VideoFrame.TimePosition = self.NativeSeekTarget
				if self.RequestedPlay then self:Play() else self:_setState(State.Paused) end
			elseif os.clock() - self.NativeLoadStarted > 30 then
				self.Error = "Roblox video did not load. Check moderation and experience permissions."
				self:_setState(State.Error)
			end
		elseif self.State == State.Playing then
			self.CurrentTime = math.max(0, self.VideoFrame.TimePosition - self.NativeStart)
			if self.VideoFrame.TimePosition >= self.NativeEnd - 0.03 then
				self.CurrentTime = self.NativeDuration
				self.VideoFrame:Pause()
				self:_setState(State.Ended)
				self.Ended:Fire()
			end
		elseif self.State == State.Paused and self.VideoFrame.IsLoaded then
			if self.NativeSeekTarget then
				if math.abs(self.VideoFrame.TimePosition - self.NativeSeekTarget) > 0.08 then
					self.VideoFrame.TimePosition = self.NativeSeekTarget
				else
					self.CurrentTime = math.clamp(self.NativeSeekTarget - self.NativeStart, 0, self.NativeDuration)
					self.NativeSeekTarget = nil
				end
			else
				self.CurrentTime = math.clamp(self.VideoFrame.TimePosition - self.NativeStart, 0, self.NativeDuration)
			end
		end
		return
	end
	self:_maintainBuffer()
	if self.State == State.Playing then
		self.CurrentTime = os.clock() - self.ClockStart
		if self.CurrentTime >= self.Metadata.duration then
			self.CurrentTime = self.Metadata.duration
			self:_syncSound(false)
			self:_setState(State.Ended)
			self.Ended:Fire()
			return
		end
		local frameIndex = math.floor(self.CurrentTime * self.Metadata.fps)
		if frameIndex ~= self.LastRenderedFrame and not self:_renderFrame(frameIndex) then
			self:_setState(State.Buffering)
			self:_syncSound(false)
		else
			self:_syncSound(true)
		end
	elseif self.State == State.Buffering then
		self:_syncSound(false)
		local frameIndex = math.floor(self.CurrentTime * self.Metadata.fps)
		if self.Buffer:GetBufferedSeconds(frameIndex) >= Config.ResumeBufferSeconds and self:_renderFrame(frameIndex) then
			self.ClockStart = os.clock() - self.CurrentTime
			self:_setState(State.Playing)
		end
	elseif self.State == State.Paused and self.LastRenderedFrame < 0 then
		self:_renderFrame(0)
	end
end

function CustomVideoPlayer:Play()
	if not self.Metadata or self.State == State.Error then return end
	if self.NativeMode then
		self.RequestedPlay = true
		if not self.VideoFrame.IsLoaded then self:_setState(State.Loading) return end
		if self.State == State.Ended or self.CurrentTime >= self.NativeDuration then self.CurrentTime = 0 end
		self.VideoFrame.TimePosition = self.NativeStart + self.CurrentTime
		self.NativeSeekTarget = nil
		self.PlaybackStarted = self.PlaybackStarted or os.clock()
		self.VideoFrame:Play()
		self:_setState(State.Playing)
		return
	end
	if self.State == State.Ended or self.CurrentTime >= self.Metadata.duration then
		self.CurrentTime = 0
		self.LastRenderedFrame = -1
	end
	self.RequestedPlay = true
	self.PlaybackStarted = self.PlaybackStarted or os.clock()
	local frameIndex = math.floor(self.CurrentTime * self.Metadata.fps)
	if self.Buffer:GetBufferedSeconds(frameIndex) >= Config.StartBufferSeconds then
		self.ClockStart = os.clock() - self.CurrentTime
		self:_setState(State.Playing)
		self:_syncSound(true)
	else
		self:_setState(State.Buffering)
	end
end

function CustomVideoPlayer:Pause()
	if self.NativeMode then
		self.RequestedPlay = false
		if self.State == State.Loading or not self.VideoFrame.IsLoaded then
			-- Stay in Loading so _step can apply a seek requested before Roblox
			-- finished preparing the native asset. IsLoaded can briefly remain true
			-- for a previously cached asset, so State.Loading is the reliable check.
			self.VideoFrame:Pause()
			if self.Metadata and self.State ~= State.Error then self:_setState(State.Loading) end
			return
		end
		self.CurrentTime = math.clamp(self.VideoFrame.TimePosition - self.NativeStart, 0, self.NativeDuration)
		self.VideoFrame:Pause()
		if self.Metadata and self.State ~= State.Error then self:_setState(State.Paused) end
		return
	end
	if self.State == State.Playing then self.CurrentTime = os.clock() - self.ClockStart end
	self.RequestedPlay = false
	self:_syncSound(false)
	if self.Metadata and self.State ~= State.Error then self:_setState(State.Paused) end
end

function CustomVideoPlayer:Resume() self:Play() end

function CustomVideoPlayer:Stop()
	self.Generation += 1
	self.RequestedPlay = false
	self.CurrentTime = 0
	self.LastRenderedFrame = -1
	self.Sound:Stop()
	self.VideoFrame:Pause()
	self.VideoFrame.Video = ""
	self.VideoFrame.Visible = false
	self.NativeMode = false
	self.NativeSeekTarget = nil
	if self.Buffer then self.Buffer:Clear() end
	self.Metadata = nil
	table.clear(self.Fetching)
	self:_setState(State.Idle)
end

function CustomVideoPlayer:Seek(seconds)
	if not self.Metadata then return end
	if self.NativeMode then
		self.CurrentTime = math.clamp(seconds, 0, self.NativeDuration)
		self.NativeSeekTarget = self.NativeStart + self.CurrentTime
		if self.VideoFrame.IsLoaded then self.VideoFrame.TimePosition = self.NativeSeekTarget end
		return
	end
	self.CurrentTime = math.clamp(seconds, 0, self.Metadata.duration)
	self.LastRenderedFrame = -1
	if self.RequestedPlay then self:Play() end
end

function CustomVideoPlayer:GetCurrentTime() return self.CurrentTime end
function CustomVideoPlayer:GetDuration()
	if self.NativeMode then return self.NativeDuration or 0 end
	return self.Metadata and self.Metadata.duration or 0
end
function CustomVideoPlayer:GetActualFPS()
	if self.NativeMode then return tonumber(self.Metadata and self.Metadata.fps) or Config.FPS or 30 end
	if not self.PlaybackStarted then return 0 end
	return self.Metrics.Rendered / math.max(0.001, os.clock() - self.PlaybackStarted)
end
function CustomVideoPlayer:GetBufferedSeconds()
	if self.NativeMode then return self.VideoFrame.IsLoaded and math.max(0, self.NativeDuration - self.CurrentTime) or 0 end
	if not self.Metadata or not self.Buffer then return 0 end
	return self.Buffer:GetBufferedSeconds(math.floor(self.CurrentTime * self.Metadata.fps))
end

function CustomVideoPlayer:Destroy()
	self:Stop()
	if self.Connection then self.Connection:Disconnect() end
	if self.EditableImage then self.ImageLabel.ImageContent = Content.none self.EditableImage:Destroy() end
	if self.VideoFrame then self.VideoFrame:Destroy() end
	if self.Sound then self.Sound:Destroy() end
	self.StateChanged:Destroy()
	self.Ended:Destroy()
end

return CustomVideoPlayer
