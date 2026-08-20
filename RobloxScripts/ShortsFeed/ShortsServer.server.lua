local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local TextService = game:GetService("TextService")
local Workspace = game:GetService("Workspace")

local modules = ReplicatedStorage:WaitForChild("ShortsFeed")
local Config = require(modules.Config)

local remotes = ReplicatedStorage:FindFirstChild("ShortsFeedRemotes") or Instance.new("Folder")
remotes.Name = "ShortsFeedRemotes"
remotes.Parent = ReplicatedStorage

local apiRemote = remotes:FindFirstChild("Api") or Instance.new("RemoteFunction")
apiRemote.Name = "Api"
apiRemote.Parent = remotes

local chunkRemote = remotes:FindFirstChild("Chunk") or Instance.new("RemoteFunction")
chunkRemote.Name = "Chunk"
chunkRemote.Parent = remotes

local function ensureWorld()
	local model = workspace:FindFirstChild("ShortsSystem") or Instance.new("Model")
	model.Name = "ShortsSystem"
	model.Parent = workspace
	local screen = model:FindFirstChild("Screen") or Instance.new("Part")
	screen.Name = "Screen"
	screen.Anchored = true
	screen.CanCollide = true
	screen.Color = Color3.fromRGB(8, 8, 10)
	screen.Material = Enum.Material.SmoothPlastic
	screen.Size = Vector3.new(6, 10.65, 0.4)
	if not screen.Parent then screen.CFrame = CFrame.new(0, 5.7, -8) end
	screen.Parent = model
	local cameraPoint = model:FindFirstChild("CameraPoint") or Instance.new("Part")
	cameraPoint.Name = "CameraPoint"
	cameraPoint.Anchored = true
	cameraPoint.CanCollide = false
	cameraPoint.CanQuery = false
	cameraPoint.CanTouch = false
	cameraPoint.Transparency = 1
	cameraPoint.Size = Vector3.new(1, 1, 1)
	if not cameraPoint.Parent then cameraPoint.CFrame = CFrame.lookAt(Vector3.new(0, 5.7, 2.5), screen.Position) end
	cameraPoint.Parent = model
	local prompt = screen:FindFirstChildOfClass("ProximityPrompt") or Instance.new("ProximityPrompt")
	prompt.Name = "WatchShorts"
	prompt.Enabled = true
	prompt.ActionText = "Watch Shorts"
	prompt.ObjectText = "Shorts"
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 24
	prompt.MaxIndicatorDistance = 24
	prompt.RequiresLineOfSight = false
	prompt.Parent = screen
end

ensureWorld()

local function validVideoId(value)
	return typeof(value) == "string" and #value > 0 and #value <= 64 and value:match("^[%w_-]+$") ~= nil
end

local function request(options)
	if Workspace:GetAttribute("ShortsSimulateRequestFailure") == true then
		error("Simulated Shorts request failure")
	end
	local simulatedDelay = tonumber(Workspace:GetAttribute("ShortsSimulateNetworkDelay")) or 0
	if simulatedDelay > 0 then task.wait(math.min(simulatedDelay, 10)) end
	local lastError = "HTTP request failed"
	for attempt = 1, Config.RequestRetries + 1 do
		local ok, response = pcall(function()
			return HttpService:RequestAsync(options)
		end)
		if ok and response.Success then return response end
		if ok then lastError = string.format("HTTP %s %s", tostring(response.StatusCode), tostring(response.StatusMessage)) else lastError = tostring(response) end
		if attempt <= Config.RequestRetries then task.wait(0.4 * (2 ^ (attempt - 1))) end
	end
	error(lastError)
end

local function requestJson(path, method, body)
	local options = {
		Url = Config.BackendUrl .. path,
		Method = method or "GET",
		Headers = { ["accept"] = "application/json" },
		Timeout = Config.RequestTimeout,
	}
	if body then
		options.Headers["content-type"] = "application/json"
		options.Body = HttpService:JSONEncode(body)
	end
	return HttpService:JSONDecode(request(options).Body)
end

local apiCalls = {}
local chunkCalls = {}
local likesStore = DataStoreService:GetDataStore("ShortsLikes_v1")
local playerNativeLikes = {}
local nativeLikeCounts = {}
local commentsStore = DataStoreService:GetDataStore("ShortsComments_v1")
local nativeComments = {}

local function playerLikesKey(player)
	return "player:" .. tostring(player.UserId)
end

local function videoLikesKey(videoId)
	return "video:" .. videoId .. ":count"
end

local function loadPlayerNativeLikes(player)
	if playerNativeLikes[player.UserId] then return playerNativeLikes[player.UserId] end
	local likes = {}
	local ok, stored = pcall(function()
		return likesStore:GetAsync(playerLikesKey(player))
	end)
	if ok and typeof(stored) == "table" then
		likes = stored
	elseif not ok then
		warn("Could not load saved Shorts likes for", player.Name, stored)
	end
	playerNativeLikes[player.UserId] = likes
	return likes
end

local function loadNativeLikeCount(videoId, fallback)
	if nativeLikeCounts[videoId] ~= nil then return nativeLikeCounts[videoId] end
	local count = math.max(0, tonumber(fallback) or 0)
	local ok, stored = pcall(function()
		return likesStore:GetAsync(videoLikesKey(videoId))
	end)
	if ok and stored ~= nil then
		count = math.max(0, tonumber(stored) or 0)
	elseif not ok then
		warn("Could not load saved Shorts like count for", videoId, stored)
	end
	nativeLikeCounts[videoId] = count
	return count
end

local function setNativeLike(player, videoId, liked, fallback)
	liked = liked == true
	local wasLiked = false
	local updatedLikes = nil
	local ok, message = pcall(function()
		updatedLikes = likesStore:UpdateAsync(playerLikesKey(player), function(current)
			current = typeof(current) == "table" and current or {}
			wasLiked = current[videoId] == true
			current[videoId] = liked or nil
			return current
		end)
	end)
	if not ok then error("Could not save like: " .. tostring(message)) end

	local count = loadNativeLikeCount(videoId, fallback)
	if wasLiked ~= liked then
		local countOk, countMessage = pcall(function()
			count = likesStore:UpdateAsync(videoLikesKey(videoId), function(current)
				local currentCount = math.max(0, tonumber(current) or count)
				return math.max(0, currentCount + (liked and 1 or -1))
			end)
		end)
		if not countOk then
			pcall(function()
				likesStore:UpdateAsync(playerLikesKey(player), function(current)
					current = typeof(current) == "table" and current or {}
					current[videoId] = wasLiked or nil
					return current
				end)
			end)
			error("Could not save like count: " .. tostring(countMessage))
		end
	end
	playerNativeLikes[player.UserId] = updatedLikes
	nativeLikeCounts[videoId] = math.max(0, tonumber(count) or 0)
	return { likes = nativeLikeCounts[videoId], likedByCurrentUser = liked }
end

local function commentsKey(videoId)
	return "video:" .. videoId
end

local function loadNativeComments(videoId)
	if nativeComments[videoId] then return nativeComments[videoId] end
	local comments = {}
	local ok, stored = pcall(function()
		return commentsStore:GetAsync(commentsKey(videoId))
	end)
	if ok and typeof(stored) == "table" then comments = stored end
	nativeComments[videoId] = comments
	return comments
end

local function addNativeComment(player, videoId, rawText)
	local text = tostring(rawText or ""):match("^%s*(.-)%s*$") or ""
	if text == "" then error("Comment cannot be empty") end
	if utf8.len(text) > 180 then error("Comment is too long") end
	local filtered = TextService:FilterStringAsync(text, player.UserId)
	local safeText = filtered:GetNonChatStringForBroadcastAsync()
	if safeText == "" then error("Comment was blocked by Roblox text filtering") end
	local comment = {
		id = HttpService:GenerateGUID(false),
		userId = player.UserId,
		username = player.Name,
		text = safeText,
		createdAt = DateTime.now():ToIsoDate(),
		likes = 0,
	}
	local updated = nil
	local ok, message = pcall(function()
		updated = commentsStore:UpdateAsync(commentsKey(videoId), function(current)
			current = typeof(current) == "table" and current or {}
			table.insert(current, 1, comment)
			while #current > 100 do table.remove(current) end
			return current
		end)
	end)
	if not ok then error("Could not save comment: " .. tostring(message)) end
	nativeComments[videoId] = updated
	return comment, updated
end

local function commentsForPlayer(player, videoId)
	local result = {}
	local playerKey = tostring(player.UserId)
	for _, source in loadNativeComments(videoId) do
		local comment = table.clone(source)
		comment.likedByCurrentUser = typeof(source.likedBy) == "table" and source.likedBy[playerKey] == true
		comment.likedBy = nil
		table.insert(result, comment)
	end
	return result
end

local function setNativeCommentLike(player, videoId, value)
	if typeof(value) ~= "table" then error("Invalid comment like request") end
	local commentId = tostring(value.commentId or "")
	if commentId == "" then error("Missing comment ID") end
	local liked = value.liked == true
	local playerKey = tostring(player.UserId)
	local updatedComment = nil
	local updated = nil
	local ok, message = pcall(function()
		updated = commentsStore:UpdateAsync(commentsKey(videoId), function(current)
			current = typeof(current) == "table" and current or {}
			for _, comment in current do
				if comment.id == commentId then
					comment.likedBy = typeof(comment.likedBy) == "table" and comment.likedBy or {}
					local wasLiked = comment.likedBy[playerKey] == true
					if wasLiked ~= liked then
						comment.likedBy[playerKey] = liked or nil
						comment.likes = math.max(0, (tonumber(comment.likes) or 0) + (liked and 1 or -1))
					end
					updatedComment = comment
					break
				end
			end
			return current
		end)
	end)
	if not ok then error("Could not save comment like: " .. tostring(message)) end
	if not updatedComment then error("Comment was not found") end
	nativeComments[videoId] = updated
	return { likes = tonumber(updatedComment.likes) or 0, likedByCurrentUser = liked }
end

local function allowed(player, buckets, limit)
	local now = os.clock()
	local bucket = buckets[player.UserId]
	if not bucket or now - bucket.started >= 60 then
		buckets[player.UserId] = { started = now, count = 1 }
		return true
	end
	bucket.count += 1
	return bucket.count <= limit
end

apiRemote.OnServerInvoke = function(player, action, videoId, value)
	if not allowed(player, apiCalls, 120) then return { error = "Too many requests" } end
	local ok, result = pcall(function()
		if action == "feed" then
			if typeof(Config.NativeFeed) == "table" and #Config.NativeFeed > 0 then
				local videos = {}
				local savedLikes = loadPlayerNativeLikes(player)
				for _, source in Config.NativeFeed do
					local item = table.clone(source)
					item.likedByCurrentUser = savedLikes[item.id] == true
					item.likes = loadNativeLikeCount(item.id, item.likes)
					item.comments = #loadNativeComments(item.id)
					table.insert(videos, item)
				end
				local random = Random.new(player.UserId + math.floor(Workspace.DistributedGameTime))
				for index = #videos, 2, -1 do
					local swapIndex = random:NextInteger(1, index)
					videos[index], videos[swapIndex] = videos[swapIndex], videos[index]
				end
				return { videos = videos }
			end
			return requestJson("/feed?playerId=" .. tostring(player.UserId))
		end
		if not validVideoId(videoId) then error("Invalid video ID") end
		if typeof(Config.NativeFeed) == "table" and #Config.NativeFeed > 0 then
			local nativeItem = nil
			for _, item in Config.NativeFeed do
				if item.id == videoId then nativeItem = item break end
			end
			if nativeItem then
				if action == "metadata" then return table.clone(nativeItem) end
				if action == "like" then
					return setNativeLike(player, videoId, value, nativeItem.likes)
				end
				if action == "comments" then return { comments = commentsForPlayer(player, videoId) } end
				if action == "comment" then
					local comment, comments = addNativeComment(player, videoId, value)
					comment.likedByCurrentUser = false
					return { comment = comment, count = #comments }
				end
				if action == "commentLike" then return setNativeCommentLike(player, videoId, value) end
			end
		end
		local encodedId = HttpService:UrlEncode(videoId)
		if action == "metadata" then
			return requestJson("/video/" .. encodedId .. "/metadata?playerId=" .. tostring(player.UserId))
		elseif action == "like" then
			return requestJson("/video/" .. encodedId .. "/like", value and "POST" or "DELETE", { playerId = tostring(player.UserId) })
		elseif action == "comments" then
			return requestJson("/video/" .. encodedId .. "/comments")
		elseif action == "comment" then
			return requestJson("/video/" .. encodedId .. "/comments", "POST", { playerId = tostring(player.UserId), username = player.Name, text = tostring(value or "") })
		end
		error("Unknown API action")
	end)
	return ok and result or { error = tostring(result) }
end

local chunkCache = {}
local chunkOrder = {}
local chunkCacheBytes = 0

local function cacheChunk(key, data)
	if chunkCache[key] then return end
	chunkCache[key] = data
	chunkCacheBytes += buffer.len(data)
	table.insert(chunkOrder, key)
	while chunkCacheBytes > Config.MaxServerChunkCacheBytes and #chunkOrder > 1 do
		local oldest = table.remove(chunkOrder, 1)
		local removed = chunkCache[oldest]
		if removed then chunkCacheBytes -= buffer.len(removed) chunkCache[oldest] = nil end
	end
end

chunkRemote.OnServerInvoke = function(player, videoId, chunkIndex)
	-- Chunk requests are playback traffic (roughly two per second at the
	-- current chunk size), so they need their own larger budget. Sharing the
	-- API budget made healthy playback lock itself out after about a minute.
	if not allowed(player, chunkCalls, 600) then return nil end
	if not validVideoId(videoId) or typeof(chunkIndex) ~= "number" or chunkIndex < 0 or chunkIndex % 1 ~= 0 then return nil end
	local key = videoId .. ":" .. tostring(chunkIndex)
	if chunkCache[key] then return chunkCache[key] end
	local ok, result = pcall(function()
		local path = "/video/" .. HttpService:UrlEncode(videoId) .. "/chunk/" .. tostring(chunkIndex)
		local response = request({ Url = Config.BackendUrl .. path, Method = "GET", Headers = { ["accept"] = "application/zstd" }, Timeout = Config.RequestTimeout })
		return buffer.fromstring(response.Body)
	end)
	if not ok then warn("Shorts chunk failed:", result) return nil end
	cacheChunk(key, result)
	return result
end

game.Players.PlayerRemoving:Connect(function(player)
	apiCalls[player.UserId] = nil
	chunkCalls[player.UserId] = nil
	playerNativeLikes[player.UserId] = nil
end)

print("ShortsServer ready; backend:", Config.BackendUrl)
