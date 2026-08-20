local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(script.Parent.Config)
local remotes = ReplicatedStorage:WaitForChild("ShortsFeedRemotes")
local apiRemote = remotes:WaitForChild("Api")
local chunkRemote = remotes:WaitForChild("Chunk")

local VideoApiClient = {}

local function invoke(remote, ...)
	local arguments = table.pack(...)
	local lastError = "Request failed"
	for attempt = 1, Config.RequestRetries + 1 do
		local ok, result = pcall(function()
			return remote:InvokeServer(table.unpack(arguments, 1, arguments.n))
		end)
		if ok and result ~= nil then
			if typeof(result) == "table" and result.error then
				lastError = tostring(result.error)
			else
				return result
			end
		else
			lastError = tostring(result)
		end
		if attempt <= Config.RequestRetries then
			task.wait(0.4 * (2 ^ (attempt - 1)))
		end
	end
	error(lastError)
end

function VideoApiClient:GetFeed()
	return invoke(apiRemote, "feed")
end

function VideoApiClient:GetMetadata(videoId)
	return invoke(apiRemote, "metadata", videoId)
end

function VideoApiClient:GetChunk(videoId, chunkIndex)
	return invoke(chunkRemote, videoId, chunkIndex)
end

function VideoApiClient:SetLike(videoId, liked)
	return invoke(apiRemote, "like", videoId, liked)
end

function VideoApiClient:GetComments(videoId)
	return invoke(apiRemote, "comments", videoId)
end

function VideoApiClient:AddComment(videoId, text)
	return invoke(apiRemote, "comment", videoId, text)
end

function VideoApiClient:SetCommentLike(videoId, commentId, liked)
	return invoke(apiRemote, "commentLike", videoId, { commentId = commentId, liked = liked })
end

return VideoApiClient
