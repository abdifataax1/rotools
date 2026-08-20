local GuiService = game:GetService("GuiService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local SocialService = game:GetService("SocialService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer
local modules = game:GetService("ReplicatedStorage"):WaitForChild("ShortsFeed")
local Config = require(modules.Config)
local Types = require(modules.Types)
local NumberFormatter = require(modules.NumberFormatter)
local VideoApiClient = require(modules.VideoApiClient)
local CustomVideoPlayer = require(modules.CustomVideoPlayer)
local CameraController = require(modules.CameraController)
local UIFactory = require(modules.UIFactory)

local State = Types.PlaybackState
local ui = UIFactory.Create(player:WaitForChild("PlayerGui"))
local active = false
local navigationLocked = false
local currentIndex = 1
local feed = {}
local interactionGeneration = 0
local pointerStart = nil
local pointerType = nil
local loadedComments = {}
local debugVisible = Config.DebugOverlay and RunService:IsStudio()
local entryPosition = nil
local boundPrompt = nil
local boundPromptConnection = nil
local prefetchedFeedResponse = nil
local feedPrefetchInFlight = false

local slots = {
	Previous = { Player = CustomVideoPlayer.new(ui.Panes.Previous.Image), Pane = ui.Panes.Previous.Pane },
	Current = { Player = CustomVideoPlayer.new(ui.Panes.Current.Image), Pane = ui.Panes.Current.Pane },
	Next = { Player = CustomVideoPlayer.new(ui.Panes.Next.Image), Pane = ui.Panes.Next.Pane },
}
local worldPlayer = CustomVideoPlayer.new(ui.WorldImage)

local function prefetchFeed()
	if prefetchedFeedResponse or feedPrefetchInFlight then return end
	feedPrefetchInFlight = true
	task.spawn(function()
		local success, response = pcall(function() return VideoApiClient:GetFeed() end)
		if success and typeof(response) == "table" and typeof(response.videos) == "table" and #response.videos > 0 then
			prefetchedFeedResponse = response
		end
		feedPrefetchInFlight = false
	end)
end

local function normalizeIndex(index)
	if #feed == 0 then return nil end
	return ((index - 1) % #feed) + 1
end

local function setPanePositions()
	slots.Previous.Pane.Position = UDim2.fromScale(-1, 0)
	slots.Current.Pane.Position = UDim2.fromScale(0, 0)
	slots.Next.Pane.Position = UDim2.fromScale(1, 0)
	for _, slot in slots do slot.Pane.Visible = slot.Index ~= nil end
end

local function updateActions()
	local item = feed[currentIndex]
	if not item then return end
	ui.LikeCount.Text = NumberFormatter.Format(item.likes)
	ui.Like.Image = item.likedByCurrentUser and (Config.LikeFilledImage or Config.LikeImage) or Config.LikeImage
	ui.Like.ImageColor3 = item.likedByCurrentUser and Color3.fromRGB(255, 35, 65) or Color3.new(1, 1, 1)
	ui.CommentsCount.Text = NumberFormatter.Format(item.comments)
	ui.Progress.Size = UDim2.fromScale(0, 1)
	ui.Previous.Visible = #feed > 1
	ui.Next.Visible = #feed > 1
end

local function loadSlot(slot, index)
	index = normalizeIndex(index)
	if not index then
		slot.Index = nil
		slot.Player:Stop()
		slot.Pane.Visible = false
		return
	end
	slot.Index = index
	slot.Player:Load(feed[index])
end

local function loadThree()
	for _, slot in slots do slot.Player:Stop() end
	loadSlot(slots.Previous, currentIndex - 1)
	loadSlot(slots.Current, currentIndex)
	loadSlot(slots.Next, currentIndex + 1)
	setPanePositions()
	updateActions()
	slots.Current.Player:Play()
end

local navigate

local function closeComments()
	if not ui.CommentsPanel.Visible then return false end
	interactionGeneration += 1
	ui.CommentInput:ReleaseFocus()
	ui.CommentSearch:ReleaseFocus()
	ui.CommentsPanel.Visible = false
	return true
end

local function retryCurrent()
	if #feed == 0 then return end
	loadSlot(slots.Current, currentIndex)
	slots.Current.Player:Play()
end

navigate = function(direction)
	if not active or navigationLocked or #feed < 2 then return end
	navigationLocked = true
	interactionGeneration += 1
	closeComments()
	local outgoing = slots.Current
	local incoming = direction > 0 and slots.Next or slots.Previous
	outgoing.Player:Pause()
	local duration = Config.TransitionDuration
	local outgoingTarget = UDim2.fromScale(direction > 0 and -1 or 1, 0)
	local outgoingTween = TweenService:Create(outgoing.Pane, TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = outgoingTarget })
	local incomingTween = TweenService:Create(incoming.Pane, TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = UDim2.fromScale(0, 0) })
	outgoingTween:Play()
	incomingTween:Play()
	incomingTween.Completed:Wait()
	if direction > 0 then
		local recycled = slots.Previous
		slots.Previous = outgoing
		slots.Current = incoming
		slots.Next = recycled
		currentIndex = normalizeIndex(currentIndex + 1)
		loadSlot(slots.Next, currentIndex + 1)
	else
		local recycled = slots.Next
		slots.Next = outgoing
		slots.Current = incoming
		slots.Previous = recycled
		currentIndex = normalizeIndex(currentIndex - 1)
		loadSlot(slots.Previous, currentIndex - 1)
	end
	setPanePositions()
	updateActions()
	slots.Current.Player:Play()
	navigationLocked = false
end

local function closeFeed(immediate)
	if not active then return end
	local item = feed[currentIndex]
	local continuationTime = slots.Current.Player:GetCurrentTime()
	local activeVideo = slots.Current.Player.VideoFrame
	if item and activeVideo and activeVideo.IsLoaded then
		local nativeStart = math.max(0, tonumber(item.startTime or item.start) or 0)
		continuationTime = math.max(0, activeVideo.TimePosition - nativeStart)
	end
	active = false
	interactionGeneration += 1
	entryPosition = nil
	closeComments()
	ui.Gui.Enabled = false
	if boundPrompt and boundPrompt.Parent then boundPrompt.Enabled = true end
	for _, slot in slots do slot.Player:Stop() end
	local system = Workspace:FindFirstChild("ShortsSystem")
	local screen = system and system:FindFirstChild("Screen")
	if item and screen and ui.WorldGui and ui.WorldImage then
		ui.WorldGui.Adornee = screen
		ui.WorldGui.Enabled = true
		worldPlayer:Load(item)
		worldPlayer:Seek(math.min(continuationTime, math.max(0, worldPlayer:GetDuration() - 0.04)))
		-- Leaving the feed freezes the last frame and silences the video.
		worldPlayer:Pause()
	else
		ui.WorldGui.Enabled = false
		worldPlayer:Stop()
	end
	CameraController:Restore(immediate)
	prefetchFeed()
end

local function enterFeed()
	if active then return end
	local system = Workspace:FindFirstChild("ShortsSystem")
	local cameraPoint = system and system:FindFirstChild("CameraPoint")
	local ok, message = CameraController:Enter(cameraPoint)
	if not ok then warn("Shorts camera failed:", message) return end
	active = true
	ui.WorldGui.Enabled = false
	worldPlayer:Stop()
	if boundPrompt and boundPrompt.Parent then boundPrompt.Enabled = false end
	interactionGeneration += 1
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	entryPosition = root and root.Position or nil
	ui.Gui.Enabled = true
	ui.Loading.Visible = true
	ui.ErrorPanel.Visible = false
	local generation = interactionGeneration
	task.spawn(function()
		local waited = 0
		while not prefetchedFeedResponse and feedPrefetchInFlight and waited < 0.45 do
			task.wait(0.03)
			waited += 0.03
		end
		local response = prefetchedFeedResponse
		prefetchedFeedResponse = nil
		local success = response ~= nil
		if not success then success, response = pcall(function() return VideoApiClient:GetFeed() end) end
		if not active or generation ~= interactionGeneration then return end
		if not success or typeof(response) ~= "table" or typeof(response.videos) ~= "table" or #response.videos == 0 then
			ui.Loading.Visible = false
			ui.ErrorPanel.Visible = true
			warn("Shorts feed failed:", response)
			return
		end
		local seenIds = {}
		feed = {}
		for _, video in response.videos do
			if typeof(video.id) == "string" and not seenIds[video.id] then
				seenIds[video.id] = true
				table.insert(feed, video)
			end
		end
		if #feed == 0 then ui.Loading.Visible = false ui.ErrorPanel.Visible = true return end
		currentIndex = 1
		loadThree()
	end)
end

local renderCommentSearch

local function toggleCommentLike(comment)
	local item = feed[currentIndex]
	if not item or not comment or not comment.id then return end
	local previousLiked = comment.likedByCurrentUser == true
	local previousLikes = tonumber(comment.likes) or 0
	comment.likedByCurrentUser = not previousLiked
	comment.likes = math.max(0, previousLikes + (comment.likedByCurrentUser and 1 or -1))
	renderCommentSearch()
	task.spawn(function()
		local ok, result = pcall(function()
			return VideoApiClient:SetCommentLike(item.id, comment.id, comment.likedByCurrentUser)
		end)
		if ok then
			comment.likes = result.likes or comment.likes
			comment.likedByCurrentUser = result.likedByCurrentUser == true
		else
			comment.likes = previousLikes
			comment.likedByCurrentUser = previousLiked
		end
		renderCommentSearch()
	end)
end

renderCommentSearch = function(message)
	if message then
		UIFactory.RenderComments(ui, {}, message)
		return
	end
	local query = string.lower(ui.CommentSearch.Text:match("^%s*(.-)%s*$") or "")
	local filtered = {}
	for _, comment in loadedComments do
		local username = string.lower(tostring(comment.username or ""))
		local text = string.lower(tostring(comment.text or ""))
		if query == "" or string.find(username, query, 1, true) or string.find(text, query, 1, true) then
			table.insert(filtered, comment)
		end
	end
	UIFactory.RenderComments(ui, filtered, nil, toggleCommentLike)
	local item = feed[currentIndex]
	if query ~= "" then
		ui.CommentsStatus.Text = string.format("%d of %d comments", #filtered, #loadedComments)
	elseif item then
		local total = item.comments or #loadedComments
		ui.CommentsStatus.Text = NumberFormatter.Format(total) .. (total == 1 and " comment" or " comments")
	end
end

local function openComments()
	if not active or not feed[currentIndex] then return end
	interactionGeneration += 1
	local generation = interactionGeneration
	ui.CommentsPanel.Visible = true
	ui.CommentSearch.Text = ""
	UIFactory.RenderComments(ui, {}, "Loading comments...")
	task.spawn(function()
		local ok, response = pcall(function() return VideoApiClient:GetComments(feed[currentIndex].id) end)
		if generation ~= interactionGeneration or not ui.CommentsPanel.Visible then return end
		if ok and typeof(response.comments) == "table" then
			loadedComments = response.comments
			renderCommentSearch()
		else
			loadedComments = {}
			renderCommentSearch("Comments unavailable")
		end
	end)
end

local function toggleLike()
	local item = feed[currentIndex]
	if not active or not item then return end
	local indexAtRequest = currentIndex
	local previousLiked = item.likedByCurrentUser
	local previousLikes = item.likes
	item.likedByCurrentUser = not previousLiked
	item.likes = math.max(0, previousLikes + (item.likedByCurrentUser and 1 or -1))
	updateActions()
	task.spawn(function()
		local ok, result = pcall(function() return VideoApiClient:SetLike(item.id, item.likedByCurrentUser) end)
		if ok then
			item.likes = result.likes or item.likes
			item.likedByCurrentUser = result.likedByCurrentUser == true
		else
			item.likes = previousLikes
			item.likedByCurrentUser = previousLiked
		end
		if currentIndex == indexAtRequest then updateActions() end
	end)
end

local function inviteFriends()
	task.spawn(function()
		local ok, canInvite = pcall(function() return SocialService:CanSendGameInviteAsync(player) end)
		if ok and canInvite then
			local promptOk, promptError = pcall(function() SocialService:PromptGameInvite(player) end)
			if not promptOk then warn("Invite prompt failed:", promptError) end
		else
			warn("Invite Friends is unavailable in this Studio/client context")
		end
	end)
end

local function togglePause()
	if not active or ui.CommentsPanel.Visible or not feed[currentIndex] then return end
	local current = slots.Current.Player
	if current.State == State.Paused then current:Play() else current:Pause() end
end

ui.Next.Activated:Connect(function() navigate(1) end)
ui.Previous.Activated:Connect(function() navigate(-1) end)
ui.Exit.Activated:Connect(function() closeFeed(false) end)
ui.Retry.Activated:Connect(retryCurrent)
ui.Skip.Activated:Connect(function() navigate(1) end)
ui.Like.Activated:Connect(toggleLike)
ui.Comments.Activated:Connect(openComments)
ui.Share.Activated:Connect(inviteFriends)
ui.CloseComments.Activated:Connect(closeComments)
ui.CommentSearch:GetPropertyChangedSignal("Text"):Connect(function()
	if ui.CommentsPanel.Visible then renderCommentSearch() end
end)

local mouse = player:GetMouse()
mouse.WheelForward:Connect(function()
	if active and not ui.CommentsPanel.Visible then closeFeed(false) end
end)
mouse.WheelBackward:Connect(function()
	if active and not ui.CommentsPanel.Visible then closeFeed(false) end
end)

ui.SendComment.Activated:Connect(function()
	local item = feed[currentIndex]
	local text = ui.CommentInput.Text
	if not item or text:match("^%s*$") then return end
	ui.CommentInput.Text = ""
	task.spawn(function()
		local ok, result = pcall(function() return VideoApiClient:AddComment(item.id, text) end)
		if ok then item.comments = result.count or (item.comments + 1) updateActions() openComments() else UIFactory.RenderComments(ui, {}, "Could not post comment") end
	end)
end)

local function pointInside(guiObject, point)
	local position = guiObject.AbsolutePosition
	local size = guiObject.AbsoluteSize
	return point.X >= position.X and point.X <= position.X + size.X and point.Y >= position.Y and point.Y <= position.Y + size.Y
end

ui.Host.InputBegan:Connect(function(input)
	local kind = input.UserInputType
	if (kind == Enum.UserInputType.Touch or kind == Enum.UserInputType.MouseButton1) and not ui.CommentsPanel.Visible and not pointInside(ui.Actions, input.Position) then
		pointerStart = input.Position
		pointerType = kind
	end
end)

ui.Host.InputEnded:Connect(function(input)
	if pointerStart and input.UserInputType == pointerType then
		local delta = input.Position - pointerStart
		pointerStart = nil
		pointerType = nil
		if input.UserInputType == Enum.UserInputType.Touch and math.abs(delta.X) >= Config.SwipeThreshold and math.abs(delta.X) > math.abs(delta.Y) then
			navigate(delta.X < 0 and 1 or -1)
		elseif delta.Magnitude < 16 then
			togglePause()
		end
	end
end)

UserInputService.InputChanged:Connect(function(input, processed)
	if not active or ui.CommentsPanel.Visible then return end
	if input.UserInputType == Enum.UserInputType.MouseWheel and input.Position.Z ~= 0 then closeFeed(false) end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if UserInputService:GetFocusedTextBox() then return end
	if active and (input.KeyCode == Enum.KeyCode.W or input.KeyCode == Enum.KeyCode.A or input.KeyCode == Enum.KeyCode.S or input.KeyCode == Enum.KeyCode.D or input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.ButtonA or input.KeyCode == Enum.KeyCode.Thumbstick1) then
		local shouldJump = input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.ButtonA
		closeFeed(false)
		if shouldJump then
			task.defer(function()
				local character = player.Character
				local humanoid = character and character:FindFirstChildOfClass("Humanoid")
				if humanoid then humanoid.Jump = true end
			end)
		end
		return
	end
	if processed then return end
	if input.KeyCode == Enum.KeyCode.F then
		if active then closeFeed(false) else enterFeed() end
		return
	end
	if not active then return end
	if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.Q then
		if not closeComments() then closeFeed(false) end
	elseif input.KeyCode == Enum.KeyCode.Down or input.KeyCode == Enum.KeyCode.N then navigate(1)
	elseif input.KeyCode == Enum.KeyCode.Up or input.KeyCode == Enum.KeyCode.B then navigate(-1)
	elseif input.KeyCode == Enum.KeyCode.P then togglePause()
	elseif input.KeyCode == Enum.KeyCode.R then retryCurrent()
	elseif input.KeyCode == Enum.KeyCode.D then debugVisible = not debugVisible
	elseif input.KeyCode == Enum.KeyCode.X then loadThree() end
end)

local function bindPrompt()
	local system = Workspace:FindFirstChild("ShortsSystem")
	local screen = system and system:FindFirstChild("Screen")
	local prompt = screen and screen:FindFirstChildOfClass("ProximityPrompt")
	if prompt and prompt ~= boundPrompt then
		if boundPromptConnection then boundPromptConnection:Disconnect() end
		boundPrompt = prompt
		boundPromptConnection = prompt.Triggered:Connect(function()
			if not active then enterFeed() end
		end)
		return true
	end
	return prompt ~= nil
end

task.spawn(function()
	for _ = 1, 60 do
		if bindPrompt() then return end
		task.wait(1)
	end
	warn("Shorts ProximityPrompt was not found; press F in Studio")
end)

-- Start fetching before the player reaches the prompt so opening feels instant.
prefetchFeed()

Workspace.DescendantAdded:Connect(function(child)
	if child:IsA("ProximityPrompt") then task.defer(bindPrompt) end
end)

RunService.RenderStepped:Connect(function()
	if not active then return end
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if humanoid and humanoid:GetState() == Enum.HumanoidStateType.Jumping then closeFeed(false) return end
	if entryPosition and root and (root.Position - entryPosition).Magnitude >= 10 then closeFeed(false) return end
	local current = slots.Current.Player
	local duration = current:GetDuration()
	ui.Progress.Size = UDim2.fromScale(duration > 0 and math.clamp(current:GetCurrentTime() / duration, 0, 1) or 0, 1)
	ui.Loading.Visible = current.State == State.Loading or current.State == State.Buffering
	if ui.Loading.Visible then ui.LoadingGradient.Rotation = (os.clock() * 260) % 360 end
	ui.PauseIndicator.Visible = current.State == State.Paused
	ui.ErrorPanel.Visible = current.State == State.Error
	if current.State == State.Ended and not navigationLocked then
		if Config.LoopPlayback then current:Play()
		elseif Config.AutoAdvance then task.defer(navigate, 1) end
	end
	ui.Debug.Visible = debugVisible
	if debugVisible then
		local item = feed[currentIndex]
		local metrics = current.Metrics
		ui.Debug.Text = string.format("Video: %s\nResolution: %dx%d\nTarget FPS: %d\nActual FPS: %.1f\nBuffered: %.2fs\nDropped: %d\nDownloaded: %.2f MB\nHTTP: %.1f ms\nDecode: %.1f ms\nRender: %.1f ms\nPlayback: %s\nCamera: %s\nNext: %s",
			item and item.id or "-", Config.Width, Config.Height, Config.FPS, current:GetActualFPS(), current:GetBufferedSeconds(), metrics.Dropped, metrics.DownloadedBytes / 1_048_576, metrics.HttpMs, metrics.DecodeMs, metrics.RenderMs, current.State, CameraController:IsActive() and "Feed" or "Normal", feed[currentIndex + 1] and feed[currentIndex + 1].id or "-")
	end
end)

Workspace.ChildRemoved:Connect(function(child)
	if active and child.Name == "ShortsSystem" then closeFeed(true) end
end)

print("ShortsClient ready. Trigger the prompt or press F in Studio.")
