-- ROBLOSX TOOLS - Photobooth local plugin
-- Paste this into a Script, then right-click the Script and choose "Save as Local Plugin".
-- It renders only the selected model inside a private ViewportFrame, not the Workspace world.

local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local toolbar = plugin:CreateToolbar("ROBLOSX TOOLS")
local button = toolbar:CreateButton("ROBLOSX TOOLS", "Photobooth icon maker for selected models", "")
button.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 872, 620, 520, 420)
local widget = plugin:CreateDockWidgetPluginGui("ROBLOSX_TOOLS_PHOTOBOOTH_V1", widgetInfo)
widget.Title = "ROBLOSX TOOLS"

local settings = {
	yaw = 45,
	pitch = 25,
	fov = 40,
	brightness = 180,
	panX = 0,
	panY = 0,
	outline = true,
	outlineThickness = 0.04,
	outlineColor = Color3.fromRGB(0, 0, 0),
}

local root = Instance.new("Frame")
root.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
root.BorderSizePixel = 0
root.Size = UDim2.fromScale(1, 1)
root.Parent = widget

local header = Instance.new("Frame")
header.BackgroundColor3 = Color3.fromRGB(18, 18, 18)
header.BorderSizePixel = 0
header.Size = UDim2.new(1, 0, 0, 205)
header.Parent = root

local content = Instance.new("ScrollingFrame")
content.BackgroundColor3 = Color3.fromRGB(36, 36, 36)
content.BorderSizePixel = 0
content.Position = UDim2.fromOffset(0, 205)
content.Size = UDim2.new(1, 0, 1, -255)
content.CanvasSize = UDim2.fromOffset(0, 0)
content.ScrollBarThickness = 8
content.Parent = root

local footer = Instance.new("Frame")
footer.BackgroundColor3 = Color3.fromRGB(14, 14, 14)
footer.BorderSizePixel = 0
footer.Position = UDim2.new(0, 0, 1, -50)
footer.Size = UDim2.new(1, 0, 0, 50)
footer.Parent = root

local grid = Instance.new("UIGridLayout")
grid.CellSize = UDim2.fromOffset(188, 222)
grid.CellPadding = UDim2.fromOffset(12, 12)
grid.SortOrder = Enum.SortOrder.LayoutOrder
grid.Parent = content

local selected = {}
local viewports = {}

local function text(parent, value, x, y, w, h)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Gotham
	label.Text = value
	label.TextColor3 = Color3.fromRGB(220, 220, 220)
	label.TextSize = 12
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Position = UDim2.fromOffset(x, y)
	label.Size = UDim2.fromOffset(w, h)
	label.Parent = parent
	return label
end

local function buttonUi(parent, value, x, y, w, h, color)
	local b = Instance.new("TextButton")
	b.BackgroundColor3 = color or Color3.fromRGB(64, 64, 64)
	b.BorderSizePixel = 0
	b.Font = Enum.Font.GothamMedium
	b.Text = value
	b.TextColor3 = Color3.fromRGB(245, 245, 245)
	b.TextSize = 12
	b.Position = UDim2.fromOffset(x, y)
	b.Size = UDim2.fromOffset(w, h)
	b.Parent = parent
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 4)
	corner.Parent = b
	return b
end

local function slider(parent, name, key, min, max, y, suffix)
	text(parent, name, 10, y, 54, 22)
	local value = text(parent, tostring(settings[key]) .. (suffix or ""), 820, y, 42, 22)
	value.TextXAlignment = Enum.TextXAlignment.Right

	local bar = Instance.new("TextButton")
	bar.Text = ""
	bar.BackgroundColor3 = Color3.fromRGB(76, 76, 76)
	bar.BorderSizePixel = 0
	bar.Position = UDim2.fromOffset(65, y + 8)
	bar.Size = UDim2.new(1, -115, 0, 6)
	bar.Parent = parent
	local round = Instance.new("UICorner")
	round.CornerRadius = UDim.new(1, 0)
	round.Parent = bar

	local fill = Instance.new("Frame")
	fill.BackgroundColor3 = Color3.fromRGB(18, 136, 236)
	fill.BorderSizePixel = 0
	fill.Size = UDim2.fromScale((settings[key] - min) / (max - min), 1)
	fill.Parent = bar
	local fillRound = Instance.new("UICorner")
	fillRound.CornerRadius = UDim.new(1, 0)
	fillRound.Parent = fill

	local function setFromX(x)
		local a = math.clamp((x - bar.AbsolutePosition.X) / math.max(1, bar.AbsoluteSize.X), 0, 1)
		settings[key] = math.floor(min + (max - min) * a + 0.5)
		fill.Size = UDim2.fromScale(a, 1)
		value.Text = tostring(settings[key]) .. (suffix or "")
		for _, data in ipairs(viewports) do
			if data.camera and data.clone then
				local size = data.size
				local radius = math.max(size.X, size.Y, size.Z, 1)
				local yaw = math.rad(settings.yaw)
				local pitch = math.rad(settings.pitch)
				local distance = radius * 2.4
				local offset = CFrame.Angles(0, yaw, 0) * CFrame.Angles(pitch, 0, 0)
				local pos = offset:VectorToWorldSpace(Vector3.new(0, 0, distance))
				local target = Vector3.new(settings.panX / 25, settings.panY / 25, 0)
				data.camera.FieldOfView = settings.fov
				data.camera.CFrame = CFrame.lookAt(pos + target, target)
				data.viewport.Ambient = Color3.fromRGB(settings.brightness, settings.brightness, settings.brightness)
			end
		end
	end

	bar.MouseButton1Down:Connect(setFromX)
end

local function getBounds(inst)
	if inst:IsA("Model") then
		return inst:GetBoundingBox()
	elseif inst:IsA("BasePart") then
		return inst.CFrame, inst.Size
	end
	return CFrame.new(), Vector3.one
end

local function prepClone(source)
	local clone = source:Clone()
	local boxCf, boxSize = getBounds(clone)
	if clone:IsA("Model") then
		clone:PivotTo(CFrame.new() * boxCf:Inverse() * clone:GetPivot())
	elseif clone:IsA("BasePart") then
		clone.CFrame = CFrame.new()
	end
	for _, item in ipairs(clone:GetDescendants()) do
		if item:IsA("BasePart") then
			item.Anchored = true
			item.CastShadow = false
		end
	end
	return clone, boxSize
end

local function addOutline(world, clone)
	if not settings.outline then return end
	local outline = clone:Clone()
	outline.Name = "_Outline"
	for _, item in ipairs(outline:GetDescendants()) do
		if item:IsA("BasePart") then
			item.Color = settings.outlineColor
			item.Material = Enum.Material.SmoothPlastic
			item.Transparency = 0
			for _, d in ipairs(item:GetDescendants()) do
				if d:IsA("Decal") or d:IsA("Texture") or d:IsA("SurfaceAppearance") then
					d:Destroy()
				end
			end
		end
	end
	if outline:IsA("Model") then
		outline:ScaleTo(1 + settings.outlineThickness)
	elseif outline:IsA("BasePart") then
		outline.Size = outline.Size * (1 + settings.outlineThickness)
	end
	outline.Parent = world
end

local function addCard(source, order)
	local card = Instance.new("Frame")
	card.BackgroundColor3 = Color3.fromRGB(55, 55, 55)
	card.BorderSizePixel = 0
	card.LayoutOrder = order
	card.Parent = content
	local cardCorner = Instance.new("UICorner")
	cardCorner.CornerRadius = UDim.new(0, 5)
	cardCorner.Parent = card

	local viewport = Instance.new("ViewportFrame")
	viewport.BackgroundColor3 = Color3.fromRGB(12, 12, 12)
	viewport.BorderSizePixel = 0
	viewport.Position = UDim2.fromOffset(2, 2)
	viewport.Size = UDim2.new(1, -4, 0, 182)
	viewport.Ambient = Color3.fromRGB(settings.brightness, settings.brightness, settings.brightness)
	viewport.LightColor = Color3.fromRGB(255, 255, 255)
	viewport.LightDirection = Vector3.new(-1, -1, -1)
	viewport.Parent = card

	local world = Instance.new("WorldModel")
	world.Parent = viewport

	local clone, size = prepClone(source)
	addOutline(world, clone)
	clone.Parent = world

	local camera = Instance.new("Camera")
	camera.Parent = viewport
	viewport.CurrentCamera = camera

	local data = { source = source, viewport = viewport, world = world, clone = clone, camera = camera, size = size }
	table.insert(viewports, data)

	local name = text(card, source.Name, 0, 190, 188, 20)
	name.TextXAlignment = Enum.TextXAlignment.Center
end

local function refresh()
	selected = {}
	viewports = {}
	for _, child in ipairs(content:GetChildren()) do
		if not child:IsA("UIGridLayout") then child:Destroy() end
	end
	for _, item in ipairs(Selection:Get()) do
		if item:IsA("Model") or item:IsA("BasePart") then
			table.insert(selected, item)
		end
	end
	for i, item in ipairs(selected) do
		addCard(item, i)
	end
	content.CanvasSize = UDim2.fromOffset(0, math.ceil(#selected / 4) * 236)
end

local function exportAll()
	ChangeHistoryService:SetWaypoint("Before ROBLOSX TOOLS ImageLabel export")
	local folder = game:GetService("ReplicatedStorage"):FindFirstChild("ROBLOSX_TOOLS_ImageLabels") or Instance.new("Folder")
	folder.Name = "ROBLOSX_TOOLS_ImageLabels"
	folder.Parent = game:GetService("ReplicatedStorage")

	for _, data in ipairs(viewports) do
		local holder = Instance.new("Frame")
		holder.Name = data.source.Name .. "_Icon"
		holder.BackgroundTransparency = 1
		holder.Size = UDim2.fromOffset(256, 256)
		holder.Parent = folder

		local image = Instance.new("ImageLabel")
		image.Name = "IconImageLabel"
		image.BackgroundTransparency = 1
		image.Size = UDim2.fromScale(1, 1)
		image.ScaleType = Enum.ScaleType.Fit
		image.Parent = holder

		local ok, snapshot = false, nil
		if data.viewport.CaptureSnapshotAsync then
			-- Captures the private preview ViewportFrame only: selected model plus baked outline, not the world.
			ok, snapshot = pcall(function()
				return data.viewport:CaptureSnapshotAsync()
			end)
		end

		if ok and snapshot then
			pcall(function()
				image.Image = tostring(snapshot)
			end)
			pcall(function()
				image.ImageContent = snapshot
			end)
			image:SetAttribute("SnapshotContent", tostring(snapshot))
		else
			image:SetAttribute("CaptureFailed", true)
			image:SetAttribute("WhyBlank", "Studio did not return a snapshot from ViewportFrame:CaptureSnapshotAsync().")
		end
	end
	ChangeHistoryService:SetWaypoint("After ROBLOSX TOOLS ImageLabel export")
end
buttonUi(header, "Front", 78, 8, 82, 30, Color3.fromRGB(64, 64, 64)).MouseButton1Click:Connect(function() settings.yaw = 0; settings.pitch = 0; refresh() end)
buttonUi(header, "Side", 168, 8, 82, 30, Color3.fromRGB(64, 64, 64)).MouseButton1Click:Connect(function() settings.yaw = 90; settings.pitch = 0; refresh() end)
buttonUi(header, "Iso", 258, 8, 82, 30, Color3.fromRGB(64, 64, 64)).MouseButton1Click:Connect(function() settings.yaw = 45; settings.pitch = 25; refresh() end)
buttonUi(header, "3/4", 348, 8, 82, 30, Color3.fromRGB(64, 64, 64)).MouseButton1Click:Connect(function() settings.yaw = 35; settings.pitch = 15; refresh() end)
text(header, "Preset:", 10, 14, 60, 18)
slider(header, "Yaw", "yaw", -180, 180, 52, " deg")
slider(header, "Pitch", "pitch", -90, 90, 82, " deg")
slider(header, "FOV", "fov", 20, 90, 112, " deg")
slider(header, "Bright", "brightness", 0, 255, 142, "")
slider(header, "Pan X", "panX", -100, 100, 172, "")

local status = text(footer, "Select models, then Capture All", 14, 14, 240, 22)
buttonUi(footer, "Capture All", 500, 8, 178, 34, Color3.fromRGB(18, 136, 236)).MouseButton1Click:Connect(function()
	refresh()
	status.Text = tostring(#selected) .. " model(s) captured"
end)
buttonUi(footer, "Export All", 692, 8, 170, 34, Color3.fromRGB(33, 168, 83)).MouseButton1Click:Connect(function()
	exportAll()
	status.Text = "Exported to ReplicatedStorage/ROBLOSX_TOOLS_ImageLabels"
end)

Selection.SelectionChanged:Connect(function()
	if widget.Enabled then
		refresh()
		status.Text = tostring(#selected) .. " model(s) selected"
	end
end)

button.Click:Connect(function()
	widget.Enabled = not widget.Enabled
	if widget.Enabled then
		refresh()
		status.Text = tostring(#selected) .. " model(s) selected"
	end
end)
