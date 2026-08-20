-- Paste this LocalScript into StarterPlayer > StarterPlayerScripts.
-- It makes the buttons on workspace.Computer's SurfaceGui clickable for each player.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remote = ReplicatedStorage:WaitForChild("ComputerShortsRemote")
local computer = workspace:WaitForChild("Computer")
local gui = computer:WaitForChild("ComputerShortsGui")
local root = gui:WaitForChild("Root")

local actions = root:WaitForChild("Actions")
local likeButton = actions:WaitForChild("LikeButton")
local commentButton = actions:WaitForChild("CommentButton")
local shareButton = actions:WaitForChild("ShareButton")
local commentsPanel = root:WaitForChild("CommentsPanel")
local closeComments = commentsPanel:WaitForChild("CloseComments")
local sendButton = commentsPanel:WaitForChild("SendButton")

likeButton.Activated:Connect(function()
	remote:FireServer("like")
end)

commentButton.Activated:Connect(function()
	remote:FireServer("comments-open")
end)

shareButton.Activated:Connect(function()
	remote:FireServer("next")
end)

closeComments.Activated:Connect(function()
	remote:FireServer("comments-close")
end)

sendButton.Activated:Connect(function()
	remote:FireServer("comments-close")
end)
