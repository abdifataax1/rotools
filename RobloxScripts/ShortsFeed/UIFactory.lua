local Config = require(script.Parent.Config)
local NumberFormatter = require(script.Parent.NumberFormatter)
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local UIFactory = {}

local function make(className, properties)
	local instance = Instance.new(className)
	for key, value in properties do instance[key] = value end
	return instance
end

local function corner(parent, radius)
	make("UICorner", { CornerRadius = UDim.new(0, radius), Parent = parent })
end

local function actionButton(name, image, order, parent, showCount)
	local holder = make("Frame", {
		Name = name .. "Holder",
		BackgroundTransparency = 1,
		LayoutOrder = order,
		Size = UDim2.fromOffset(62, showCount and 80 or 54),
		Parent = parent,
	})
	local button = make("ImageButton", {
		Name = name,
		BackgroundTransparency = 1,
		Image = image,
		ImageColor3 = Color3.new(1, 1, 1),
		ScaleType = Enum.ScaleType.Fit,
		Size = UDim2.fromOffset(46, 46),
		Position = UDim2.new(0.5, -23, 0, 0),
		AutoButtonColor = false,
		Parent = holder,
	})
	local count = nil
	if showCount then
		count = make("TextLabel", {
			Name = "Count",
			BackgroundTransparency = 1,
			Font = Enum.Font.GothamBold,
			Text = "0",
			TextColor3 = Color3.new(1, 1, 1),
			TextSize = 15,
			Position = UDim2.fromOffset(0, 46),
			Size = UDim2.fromOffset(62, 22),
			TextStrokeColor3 = Color3.new(0, 0, 0),
			TextStrokeTransparency = 0.35,
			Parent = holder,
		})
	end
	return button, count
end

function UIFactory.Create(playerGui)
	local old = playerGui:FindFirstChild("ShortsFeedGui")
	if old then old:Destroy() end
	local gui = make("ScreenGui", { Name = "ShortsFeedGui", IgnoreGuiInset = true, ResetOnSpawn = false, Enabled = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = playerGui })
	local backdrop = make("Frame", { Name = "Backdrop", BackgroundColor3 = Color3.fromRGB(4, 4, 6), BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Parent = gui })
	local host = make("Frame", { Name = "VideoHost", Active = true, AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, ClipsDescendants = true, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(0.46, 0.88), Parent = backdrop })
	make("UIAspectRatioConstraint", { AspectRatio = Config.Width / Config.Height, DominantAxis = Enum.DominantAxis.Height, Parent = host })
	make("UISizeConstraint", { MinSize = Vector2.new(220, 390), MaxSize = Vector2.new(610, 1085), Parent = host })
	corner(host, 7)
	make("UIStroke", { ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Color = Color3.fromRGB(8, 8, 10), Thickness = 6, Transparency = 0, Parent = host })

	local panes = {}
	for _, role in { "Previous", "Current", "Next" } do
		local pane = make("Frame", { Name = role .. "Pane", BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, Position = UDim2.fromScale(0, role == "Previous" and -1 or role == "Next" and 1 or 0), Size = UDim2.fromScale(1, 1), Parent = host })
		local image = make("ImageLabel", { Name = "Video", BackgroundColor3 = Color3.fromRGB(12, 12, 14), BorderSizePixel = 0, Image = "", ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromScale(1, 1), Parent = pane })
		panes[role] = { Pane = pane, Image = image }
	end

	local actions = make("Frame", { Name = "Actions", BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.fromScale(0.975, 0.64), Size = UDim2.fromOffset(66, 280), ZIndex = 10, Parent = host })
	make("UIListLayout", { Padding = UDim.new(0, 10), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder, VerticalAlignment = Enum.VerticalAlignment.Center, Parent = actions })
	local like, likeCount = actionButton("Like", Config.LikeImage, 1, actions, true)
	local comments, commentsCount = actionButton("Comments", Config.CommentImage, 2, actions, true)
	local share = actionButton("Share", Config.ShareImage, 3, actions, false)

	local loading = make("Frame", { Name = "Loading", BackgroundColor3 = Color3.fromRGB(28, 28, 30), BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 11, Parent = host })
	local loadingRing = make("Frame", { Name = "Ring", AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(190, 190), ZIndex = 12, Parent = loading })
	corner(loadingRing, 95)
	local loadingStroke = make("UIStroke", { ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Color = Color3.new(1, 1, 1), Thickness = 18, Transparency = 0, Parent = loadingRing })
	local loadingGradient = make("UIGradient", {
		Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(95, 95, 100)),
		Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.68, 0), NumberSequenceKeypoint.new(0.86, 0.45), NumberSequenceKeypoint.new(1, 1) }),
		Rotation = 0,
		Parent = loadingStroke,
	})
	local pauseIndicator = make("TextLabel", { Name = "PauseIndicator", AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.28, Font = Enum.Font.GothamBold, Text = utf8.char(0x25B6), TextColor3 = Color3.new(1, 1, 1), TextSize = 38, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(76, 76), Visible = false, ZIndex = 12, Parent = host })
	corner(pauseIndicator, 38)
	local errorPanel = make("Frame", { Name = "ErrorPanel", AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.fromRGB(16, 16, 18), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(260, 140), Visible = false, ZIndex = 15, Parent = host })
	corner(errorPanel, 10)
	make("TextLabel", { BackgroundTransparency = 1, Font = Enum.Font.GothamBold, Text = "Video unavailable", TextColor3 = Color3.new(1, 1, 1), TextSize = 19, Size = UDim2.new(1, 0, 0, 55), ZIndex = 16, Parent = errorPanel })
	local retry = make("TextButton", { Name = "Retry", BackgroundColor3 = Color3.fromRGB(45, 45, 50), Font = Enum.Font.GothamBold, Text = "Retry", TextColor3 = Color3.new(1, 1, 1), TextSize = 16, Position = UDim2.fromOffset(14, 72), Size = UDim2.fromOffset(108, 48), ZIndex = 16, Parent = errorPanel })
	local skip = make("TextButton", { Name = "Skip", BackgroundColor3 = Color3.fromRGB(45, 45, 50), Font = Enum.Font.GothamBold, Text = "Skip", TextColor3 = Color3.new(1, 1, 1), TextSize = 16, Position = UDim2.new(1, -122, 0, 72), Size = UDim2.fromOffset(108, 48), ZIndex = 16, Parent = errorPanel })
	corner(retry, 6) corner(skip, 6)

	local progressTrack = make("Frame", { Name = "ProgressTrack", AnchorPoint = Vector2.new(0, 1), BackgroundColor3 = Color3.fromRGB(100, 100, 105), BackgroundTransparency = 0.4, BorderSizePixel = 0, Position = UDim2.fromScale(0, 1), Size = UDim2.new(1, 0, 0, 3), ZIndex = 13, Parent = host })
	local progress = make("Frame", { Name = "Progress", BackgroundColor3 = Color3.fromRGB(255, 35, 55), BorderSizePixel = 0, Size = UDim2.fromScale(0, 1), ZIndex = 14, Parent = progressTrack })

	local previous = make("ImageButton", { Name = "Previous", AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, Image = Config.LeftArrowImage, ScaleType = Enum.ScaleType.Fit, Position = UDim2.fromScale(0.31, 0.5), Size = UDim2.fromOffset(165, 225), Parent = backdrop })
	local nextButton = make("ImageButton", { Name = "Next", AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, Image = Config.RightArrowImage, ScaleType = Enum.ScaleType.Fit, Position = UDim2.fromScale(0.69, 0.5), Size = UDim2.fromOffset(165, 225), Parent = backdrop })
	local exit = make("TextButton", { Name = "Exit", BackgroundColor3 = Color3.fromRGB(20, 20, 24), BackgroundTransparency = 0.2, Font = Enum.Font.GothamBold, Text = utf8.char(0x00D7), TextColor3 = Color3.new(1, 1, 1), TextSize = 27, Position = UDim2.fromOffset(18, 70), Size = UDim2.fromOffset(46, 46), Visible = false, Parent = backdrop })
	corner(exit, 23)

	local commentsPanel = make("Frame", { Name = "CommentsPanel", AnchorPoint = Vector2.new(0, 1), BackgroundColor3 = Color3.fromRGB(250, 250, 250), BorderSizePixel = 0, Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 0.58), Visible = false, ZIndex = 30, Parent = host })
	corner(commentsPanel, 16)
	local commentsStatus = make("TextLabel", { Name = "Status", BackgroundTransparency = 1, Font = Enum.Font.GothamBold, Text = "Comments", TextColor3 = Color3.fromRGB(20, 20, 23), TextSize = 22, Size = UDim2.new(1, 0, 0, 62), ZIndex = 31, Parent = commentsPanel })
	local closeComments = make("TextButton", { Name = "Close", BackgroundTransparency = 1, Font = Enum.Font.Gotham, Text = utf8.char(0x00D7), TextColor3 = Color3.fromRGB(20, 20, 23), TextSize = 32, Position = UDim2.new(1, -59, 0, 6), Size = UDim2.fromOffset(52, 52), ZIndex = 32, Parent = commentsPanel })
	make("Frame", { Name = "HeaderDivider", BackgroundColor3 = Color3.fromRGB(215, 215, 218), BorderSizePixel = 0, Position = UDim2.fromOffset(0, 61), Size = UDim2.new(1, 0, 0, 2), ZIndex = 31, Parent = commentsPanel })
	local commentSearch = make("TextBox", { Name = "Search", BackgroundColor3 = Color3.fromRGB(232, 232, 235), ClearTextOnFocus = false, Font = Enum.Font.Gotham, PlaceholderText = "Search comments", Text = "", TextColor3 = Color3.fromRGB(25, 25, 28), TextSize = 14, TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.fromOffset(14, 64), Size = UDim2.new(1, -28, 0, 36), Visible = false, ZIndex = 31, Parent = commentsPanel })
	corner(commentSearch, 8)
	make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12), Parent = commentSearch })
	local commentsList = make("ScrollingFrame", { Name = "List", AutomaticCanvasSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, BorderSizePixel = 0, CanvasSize = UDim2.new(), Position = UDim2.fromOffset(16, 69), ScrollBarThickness = 3, Size = UDim2.new(1, -32, 1, -153), ZIndex = 31, Parent = commentsPanel })
	make("UIListLayout", { Padding = UDim.new(0, 3), SortOrder = Enum.SortOrder.LayoutOrder, Parent = commentsList })
	make("Frame", { Name = "ComposerDivider", BackgroundColor3 = Color3.fromRGB(220, 220, 223), BorderSizePixel = 0, Position = UDim2.new(0, 0, 1, -77), Size = UDim2.new(1, 0, 0, 2), ZIndex = 31, Parent = commentsPanel })
	local input = make("TextBox", { Name = "Input", BackgroundColor3 = Color3.fromRGB(229, 229, 232), ClearTextOnFocus = false, Font = Enum.Font.Gotham, PlaceholderText = "Add a comment", Text = "", TextColor3 = Color3.fromRGB(25, 25, 28), TextSize = 18, TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.new(0, 36, 1, -61), Size = UDim2.new(1, -116, 0, 44), ZIndex = 31, Parent = commentsPanel })
	make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 8), Parent = input })
	local send = make("ImageButton", { Name = "Send", BackgroundColor3 = Color3.fromRGB(20, 165, 235), Image = Config.ShareImage, ScaleType = Enum.ScaleType.Fit, Position = UDim2.new(1, -64, 1, -61), Size = UDim2.fromOffset(44, 44), ZIndex = 31, Parent = commentsPanel })
	corner(input, 8) corner(send, 8)

	local debug = make("TextLabel", { Name = "Debug", BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.3, Font = Enum.Font.Code, Text = "", TextColor3 = Color3.fromRGB(120, 255, 160), TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Position = UDim2.fromOffset(10, 76), Size = UDim2.fromOffset(230, 210), Visible = false, ZIndex = 40, Parent = backdrop })

	local oldWorld = playerGui:FindFirstChild("ShortsWorldGui")
	if oldWorld then oldWorld:Destroy() end
	local system = Workspace:FindFirstChild("ShortsSystem")
	local screen = system and system:FindFirstChild("Screen")
	local worldGui = make("SurfaceGui", { Name = "ShortsWorldGui", Adornee = screen, AlwaysOnTop = false, CanvasSize = Vector2.new(540, 960), Enabled = false, Face = Enum.NormalId.Back, LightInfluence = 0, ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = playerGui })
	local worldHost = make("Frame", { Name = "WorldHost", BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, ClipsDescendants = true, Size = UDim2.fromScale(1, 1), Parent = worldGui })
	local worldImage = make("ImageLabel", { Name = "WorldVideo", BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, Image = "", ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromScale(1, 1), Parent = worldHost })

	return {
		Gui = gui, Backdrop = backdrop, Host = host, Panes = panes, Actions = actions,
		Like = like, LikeCount = likeCount, Comments = comments, CommentsCount = commentsCount, Share = share, Loading = loading, LoadingGradient = loadingGradient, PauseIndicator = pauseIndicator,
		ErrorPanel = errorPanel, Retry = retry, Skip = skip, Progress = progress,
		Previous = previous, Next = nextButton, Exit = exit, CommentsPanel = commentsPanel,
		CommentsStatus = commentsStatus, CommentSearch = commentSearch, CommentsList = commentsList, CloseComments = closeComments,
		CommentInput = input, SendComment = send, Debug = debug, WorldGui = worldGui, WorldImage = worldImage,
	}
end

local function relativeTime(value)
	if typeof(value) ~= "string" or value == "" then return "now" end
	local ok, parsed = pcall(DateTime.fromIsoDate, value)
	if not ok or not parsed then return "now" end
	local seconds = math.max(0, os.time() - parsed.UnixTimestamp)
	if seconds < 60 then return "now" end
	if seconds < 3600 then return string.format("%dm ago", math.floor(seconds / 60)) end
	if seconds < 86400 then return string.format("%dh ago", math.floor(seconds / 3600)) end
	return string.format("%dd ago", math.floor(seconds / 86400))
end

function UIFactory.RenderComments(ui, comments, message, onLike)
	for _, child in ui.CommentsList:GetChildren() do
		if child:IsA("GuiObject") then child:Destroy() end
	end
	if message then
		ui.CommentsStatus.Text = message
		return
	end
	ui.CommentsStatus.Text = NumberFormatter.Format(#comments) .. (#comments == 1 and " comment" or " comments")
	for index, comment in comments do
		local row = make("Frame", { BackgroundTransparency = 1, LayoutOrder = index, Size = UDim2.new(1, -6, 0, 102), ZIndex = 32, Parent = ui.CommentsList })
		local avatar = make("ImageLabel", { Name = "Avatar", BackgroundColor3 = Color3.fromRGB(205, 205, 208), BorderSizePixel = 0, Image = "", ScaleType = Enum.ScaleType.Crop, Position = UDim2.fromOffset(0, 5), Size = UDim2.fromOffset(34, 34), ZIndex = 32, Parent = row })
		corner(avatar, 17)
		local identity = make("Frame", { Name = "Identity", BackgroundTransparency = 1, Position = UDim2.fromOffset(49, 0), Size = UDim2.new(1, -126, 0, 28), ZIndex = 32, Parent = row })
		make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 7), SortOrder = Enum.SortOrder.LayoutOrder, VerticalAlignment = Enum.VerticalAlignment.Center, Parent = identity })
		local commentUsername = tostring(comment.username or "Player")
		make("TextLabel", { Name = "Username", AutomaticSize = Enum.AutomaticSize.X, BackgroundTransparency = 1, Font = Enum.Font.GothamBold, Text = commentUsername, TextColor3 = Color3.fromRGB(25, 25, 28), TextSize = 20, TextXAlignment = Enum.TextXAlignment.Left, Size = UDim2.fromOffset(0, 27), ZIndex = 32, Parent = identity })
		local isOwner = tonumber(comment.userId) == tonumber(Config.OwnerUserId) or commentUsername:gsub("^@", ""):lower() == tostring(Config.OwnerUsername or ""):lower()
		if isOwner then
			local badge = make("TextLabel", { Name = "OwnerBadge", AutomaticSize = Enum.AutomaticSize.X, BackgroundColor3 = Color3.fromRGB(218, 241, 255), Font = Enum.Font.GothamBold, Text = "  OWNER  ", TextColor3 = Color3.fromRGB(15, 142, 232), TextSize = 12, Size = UDim2.fromOffset(0, 20), ZIndex = 32, Parent = identity })
			corner(badge, 5)
		end
		make("TextLabel", { BackgroundTransparency = 1, Font = Enum.Font.Gotham, Text = tostring(comment.text or ""), TextColor3 = Color3.fromRGB(35, 35, 39), TextSize = 17, TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Position = UDim2.fromOffset(49, 29), Size = UDim2.new(1, -124, 0, 38), ZIndex = 32, Parent = row })
		make("TextLabel", { BackgroundTransparency = 1, Font = Enum.Font.Gotham, Text = relativeTime(comment.createdAt), TextColor3 = Color3.fromRGB(125, 130, 138), TextSize = 15, TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.fromOffset(49, 69), Size = UDim2.new(1, -110, 0, 23), ZIndex = 32, Parent = row })
		local commentLike = make("Frame", { Name = "Like", BackgroundTransparency = 1, Position = UDim2.new(1, -70, 0, 42), Size = UDim2.fromOffset(68, 32), ZIndex = 32, Parent = row })
		local heart = make("ImageButton", { Name = "Heart", AutoButtonColor = false, BackgroundTransparency = 1, Image = comment.likedByCurrentUser and (Config.LikeFilledImage or Config.LikeImage) or Config.LikeImage, ImageColor3 = comment.likedByCurrentUser and Color3.fromRGB(255, 45, 75) or Color3.fromRGB(105, 112, 122), ScaleType = Enum.ScaleType.Fit, Position = UDim2.fromOffset(0, 3), Size = UDim2.fromOffset(24, 24), ZIndex = 32, Parent = commentLike })
		make("TextLabel", { Name = "Count", BackgroundTransparency = 1, Font = Enum.Font.Gotham, Text = tostring(comment.likes or 0), TextColor3 = Color3.fromRGB(105, 112, 122), TextSize = 16, TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.fromOffset(28, 0), Size = UDim2.fromOffset(40, 30), ZIndex = 32, Parent = commentLike })
		if onLike then heart.Activated:Connect(function() onLike(comment) end) end
		local userId = tonumber(comment.userId)
		if userId and userId > 0 then
			task.spawn(function()
				local ok, content = pcall(Players.GetUserThumbnailAsync, Players, userId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100)
				if ok and avatar.Parent then avatar.Image = content end
			end)
		end
	end
end

return UIFactory
