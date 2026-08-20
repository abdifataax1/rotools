-- Paste this Script into ServerScriptService.
-- It creates a Roblox Shorts/TikTok-style screen on workspace.Computer.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local COMPUTER_NAME = "Computer"

-- Optional: put your own JSON API here.
-- Leave empty to use the built-in demo posts.
-- API response can be either:
-- { "posts": [ ... ] }
-- or just [ ... ]
local POSTS_API_URL = ""

-- Roblox cannot display random TikTok/YouTube videos directly.
-- Use uploaded Roblox images/video assets here. Images are the easiest.
local DEMO_POSTS = {
	{
		title = "bro is easy to draw",
		mediaType = "image",
		media = "rbxassetid://0",
		likes = 9900,
		comments = {
			{ user = "Someone", text = "Im a chud", likes = 87, age = "14d ago" },
			{ user = "Son_Gohan45602", text = "in roblox btw", likes = 66, age = "5d ago" },
			{ user = "twilight", text = "I see ts on tiktok and now on roblox", likes = 25, age = "3d ago" },
			{ user = "Mr_cheese", text = "Nah yea thats fire", likes = 17, age = "8d ago" },
		},
	},
	{
		title = "roblox shorts screen",
		mediaType = "image",
		media = "rbxassetid://0",
		likes = 12400,
		comments = {
			{ user = "Builder", text = "this actually works", likes = 101, age = "1d ago" },
			{ user = "NoobMaster", text = "add more posts", likes = 44, age = "2d ago" },
			{ user = "Dev", text = "api version soon", likes = 12, age = "now" },
		},
	},
}

local remote = ReplicatedStorage:FindFirstChild("ComputerShortsRemote")
if not remote then
	remote = Instance.new("RemoteEvent")
	remote.Name = "ComputerShortsRemote"
	remote.Parent = ReplicatedStorage
end

local function formatCount(amount)
	amount = tonumber(amount) or 0
	if amount >= 1000000 then
		return string.format("%.1fM", amount / 1000000):gsub("%.0M", "M")
	end
	if amount >= 1000 then
		return string.format("%.1fK", amount / 1000):gsub("%.0K", "K")
	end
	return tostring(amount)
end

local function getComputerPart()
	local part = workspace:FindFirstChild(COMPUTER_NAME)
	if not part then
		warn(("ComputerShorts: workspace.%s was not found."):format(COMPUTER_NAME))
		return nil
	end
	if not part:IsA("BasePart") then
		warn(("ComputerShorts: workspace.%s must be a Part/MeshPart/BasePart."):format(COMPUTER_NAME))
		return nil
	end
	return part
end

local function loadPosts()
	if POSTS_API_URL == "" then
		return DEMO_POSTS
	end

	local ok, response = pcall(function()
		return HttpService:GetAsync(POSTS_API_URL)
	end)

	if not ok then
		warn("ComputerShorts API failed, using demo posts:", response)
		return DEMO_POSTS
	end

	local decodedOk, data = pcall(function()
		return HttpService:JSONDecode(response)
	end)

	if not decodedOk then
		warn("ComputerShorts API returned invalid JSON, using demo posts:", data)
		return DEMO_POSTS
	end

	if typeof(data) == "table" and typeof(data.posts) == "table" then
		return data.posts
	end

	if typeof(data) == "table" then
		return data
	end

	return DEMO_POSTS
end

local function make(className, props, children)
	local item = Instance.new(className)
	for key, value in pairs(props or {}) do
		item[key] = value
	end
	for _, child in ipairs(children or {}) do
		child.Parent = item
	end
	return item
end

local function addCorner(parent, radius)
	make("UICorner", { CornerRadius = UDim.new(0, radius or 8), Parent = parent })
end

local function addStroke(parent, thickness, color, transparency)
	make("UIStroke", {
		Thickness = thickness or 2,
		Color = color or Color3.fromRGB(255, 255, 255),
		Transparency = transparency or 0,
		Parent = parent,
	})
end

local function renderComments(commentsFrame, comments)
	for _, child in ipairs(commentsFrame:GetChildren()) do
		if child:IsA("GuiObject") then
			child:Destroy()
		end
	end

	local list = make("UIListLayout", {
		Padding = UDim.new(0, 10),
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = commentsFrame,
	})

	for index, comment in ipairs(comments or {}) do
		local row = make("Frame", {
			Name = "Comment",
			BackgroundTransparency = 1,
			Size = UDim2.new(1, -18, 0, 74),
			LayoutOrder = index,
			Parent = commentsFrame,
		})

		make("TextLabel", {
			BackgroundTransparency = 1,
			Font = Enum.Font.GothamBold,
			Text = tostring(comment.user or "Someone"),
			TextColor3 = Color3.fromRGB(25, 25, 25),
			TextSize = 24,
			TextXAlignment = Enum.TextXAlignment.Left,
			Size = UDim2.new(1, -90, 0, 26),
			Position = UDim2.fromOffset(0, 0),
			Parent = row,
		})

		make("TextLabel", {
			BackgroundTransparency = 1,
			Font = Enum.Font.Gotham,
			Text = tostring(comment.text or ""),
			TextColor3 = Color3.fromRGB(35, 35, 35),
			TextSize = 21,
			TextWrapped = true,
			TextXAlignment = Enum.TextXAlignment.Left,
			TextYAlignment = Enum.TextYAlignment.Top,
			Size = UDim2.new(1, -90, 0, 26),
			Position = UDim2.fromOffset(0, 28),
			Parent = row,
		})

		make("TextLabel", {
			BackgroundTransparency = 1,
			Font = Enum.Font.Gotham,
			Text = tostring(comment.age or ""),
			TextColor3 = Color3.fromRGB(120, 120, 120),
			TextSize = 18,
			TextXAlignment = Enum.TextXAlignment.Left,
			Size = UDim2.new(1, -90, 0, 20),
			Position = UDim2.fromOffset(0, 54),
			Parent = row,
		})

		make("TextLabel", {
			BackgroundTransparency = 1,
			Font = Enum.Font.Gotham,
			Text = "Like " .. formatCount(comment.likes),
			TextColor3 = Color3.fromRGB(95, 95, 95),
			TextSize = 20,
			TextXAlignment = Enum.TextXAlignment.Right,
			Size = UDim2.new(0, 82, 0, 28),
			Position = UDim2.new(1, -82, 0, 20),
			Parent = row,
		})
	end

	task.defer(function()
		commentsFrame.CanvasSize = UDim2.fromOffset(0, list.AbsoluteContentSize.Y + 12)
	end)
end

local function createShortsScreen(computer, posts)
	local oldGui = computer:FindFirstChild("ComputerShortsGui")
	if oldGui then
		oldGui:Destroy()
	end

	local gui = make("SurfaceGui", {
		Name = "ComputerShortsGui",
		Adornee = computer,
		AlwaysOnTop = false,
		LightInfluence = 0,
		PixelsPerStud = 80,
		SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud,
		Face = Enum.NormalId.Front,
		Parent = computer,
	})

	local root = make("Frame", {
		Name = "Root",
		BackgroundColor3 = Color3.fromRGB(8, 11, 24),
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		Parent = gui,
	})
	addStroke(root, 4, Color3.fromRGB(30, 43, 86), 0)

	local media = make("ImageLabel", {
		Name = "Media",
		BackgroundColor3 = Color3.fromRGB(35, 35, 42),
		BorderSizePixel = 0,
		Image = "",
		ScaleType = Enum.ScaleType.Crop,
		Size = UDim2.fromScale(1, 1),
		Parent = root,
	})

	local video = make("VideoFrame", {
		Name = "Video",
		BackgroundColor3 = Color3.fromRGB(35, 35, 42),
		BorderSizePixel = 0,
		Looped = true,
		Playing = true,
		Visible = false,
		Size = UDim2.fromScale(1, 1),
		Parent = root,
	})

	local dim = make("Frame", {
		Name = "BottomDim",
		BackgroundColor3 = Color3.fromRGB(0, 0, 0),
		BackgroundTransparency = 0.45,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0.32, 0),
		Position = UDim2.fromScale(0, 0.68),
		Parent = root,
	})

	local caption = make("TextLabel", {
		Name = "Caption",
		BackgroundTransparency = 1,
		Font = Enum.Font.GothamBlack,
		Text = "",
		TextColor3 = Color3.fromRGB(255, 255, 255),
		TextStrokeColor3 = Color3.fromRGB(0, 0, 0),
		TextStrokeTransparency = 0.15,
		TextSize = 34,
		TextWrapped = true,
		Size = UDim2.new(1, -150, 0, 88),
		Position = UDim2.new(0, 26, 1, -138),
		Parent = root,
	})

	local actions = make("Frame", {
		Name = "Actions",
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(92, 250),
		Position = UDim2.new(1, -108, 0.46, 0),
		Parent = root,
	})
	make("UIListLayout", {
		Padding = UDim.new(0, 16),
		HorizontalAlignment = Enum.HorizontalAlignment.Center,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = actions,
	})

	local likeButton = make("TextButton", {
		Name = "LikeButton",
		BackgroundTransparency = 1,
		Font = Enum.Font.GothamBlack,
		Text = "LIKE\n0",
		TextColor3 = Color3.fromRGB(255, 255, 255),
		TextSize = 31,
		Size = UDim2.fromOffset(86, 78),
		Parent = actions,
	})

	local commentButton = make("TextButton", {
		Name = "CommentButton",
		BackgroundTransparency = 1,
		Font = Enum.Font.GothamBlack,
		Text = "CHAT\n0",
		TextColor3 = Color3.fromRGB(255, 255, 255),
		TextSize = 28,
		Size = UDim2.fromOffset(86, 78),
		Parent = actions,
	})

	local shareButton = make("TextButton", {
		Name = "ShareButton",
		BackgroundTransparency = 1,
		Font = Enum.Font.GothamBlack,
		Text = ">",
		TextColor3 = Color3.fromRGB(255, 255, 255),
		TextSize = 44,
		Size = UDim2.fromOffset(86, 58),
		Parent = actions,
	})

	local commentsPanel = make("Frame", {
		Name = "CommentsPanel",
		BackgroundColor3 = Color3.fromRGB(255, 255, 255),
		BorderSizePixel = 0,
		Visible = false,
		Size = UDim2.new(1, -24, 0.55, 0),
		Position = UDim2.new(0, 12, 0.43, 0),
		Parent = root,
	})
	addCorner(commentsPanel, 14)

	local commentsTitle = make("TextLabel", {
		Name = "CommentsTitle",
		BackgroundTransparency = 1,
		Font = Enum.Font.GothamBold,
		Text = "0 comments",
		TextColor3 = Color3.fromRGB(20, 20, 20),
		TextSize = 26,
		Size = UDim2.new(1, -76, 0, 52),
		Position = UDim2.fromOffset(38, 0),
		Parent = commentsPanel,
	})

	local closeComments = make("TextButton", {
		Name = "CloseComments",
		BackgroundTransparency = 1,
		Font = Enum.Font.Gotham,
		Text = "X",
		TextColor3 = Color3.fromRGB(25, 25, 25),
		TextSize = 28,
		Size = UDim2.fromOffset(50, 50),
		Position = UDim2.new(1, -56, 0, 2),
		Parent = commentsPanel,
	})

	local commentsFrame = make("ScrollingFrame", {
		Name = "CommentsList",
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		CanvasSize = UDim2.fromOffset(0, 0),
		ScrollBarThickness = 5,
		Size = UDim2.new(1, -38, 1, -112),
		Position = UDim2.fromOffset(22, 56),
		Parent = commentsPanel,
	})

	local inputBar = make("TextLabel", {
		Name = "FakeInput",
		BackgroundColor3 = Color3.fromRGB(230, 230, 230),
		Font = Enum.Font.Gotham,
		Text = "Add a comment",
		TextColor3 = Color3.fromRGB(110, 110, 110),
		TextSize = 20,
		TextXAlignment = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, -88, 0, 42),
		Position = UDim2.new(0, 22, 1, -50),
		Parent = commentsPanel,
	})
	addCorner(inputBar, 8)

	local sendButton = make("TextButton", {
		Name = "SendButton",
		BackgroundColor3 = Color3.fromRGB(23, 162, 255),
		Font = Enum.Font.GothamBold,
		Text = ">",
		TextColor3 = Color3.fromRGB(255, 255, 255),
		TextSize = 28,
		Size = UDim2.fromOffset(48, 42),
		Position = UDim2.new(1, -58, 1, -50),
		Parent = commentsPanel,
	})
	addCorner(sendButton, 8)

	local clickDetector = computer:FindFirstChildOfClass("ClickDetector") or Instance.new("ClickDetector")
	clickDetector.MaxActivationDistance = 32
	clickDetector.Parent = computer

	local currentIndex = 1
	local likedByUserId = {}

	local function renderPost()
		local post = posts[currentIndex] or DEMO_POSTS[1]
		local comments = post.comments or {}

		caption.Text = tostring(post.title or "")
		commentsPanel.Visible = false
		commentsTitle.Text = formatCount(#comments) .. " comments"
		likeButton.Text = "LIKE\n" .. formatCount(post.likes)
		likeButton.TextColor3 = Color3.fromRGB(255, 255, 255)
		commentButton.Text = "CHAT\n" .. formatCount(#comments)

		local mediaId = tostring(post.media or "")
		if post.mediaType == "video" and mediaId ~= "" and mediaId ~= "rbxassetid://0" then
			media.Visible = false
			video.Visible = true
			video.Video = mediaId
			video.Playing = true
		else
			video.Visible = false
			video.Playing = false
			media.Visible = true
			media.Image = mediaId ~= "rbxassetid://0" and mediaId or ""
		end

		renderComments(commentsFrame, comments)
	end

	local function nextPost()
		currentIndex += 1
		if currentIndex > #posts then
			currentIndex = 1
		end
		renderPost()
	end

	local function likeCurrentPost(player)
		local post = posts[currentIndex]
		if not post then
			return
		end

		local key = tostring(player.UserId) .. ":" .. tostring(currentIndex)
		if likedByUserId[key] then
			return
		end

		likedByUserId[key] = true
		post.likes = (tonumber(post.likes) or 0) + 1
		likeButton.Text = "LIKED\n" .. formatCount(post.likes)
		likeButton.TextColor3 = Color3.fromRGB(255, 72, 100)
	end

	clickDetector.MouseClick:Connect(function(player)
		nextPost()
	end)

	remote.OnServerEvent:Connect(function(player, action)
		if action == "like" then
			likeCurrentPost(player)
		elseif action == "next" then
			nextPost()
		elseif action == "comments-open" then
			commentsPanel.Visible = true
		elseif action == "comments-close" then
			commentsPanel.Visible = false
		end
	end)

	renderPost()
end

local computer = getComputerPart()
if computer then
	createShortsScreen(computer, loadPosts())
end
