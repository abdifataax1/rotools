-- Multi Photobooth - local Roblox Studio plugin
-- Drop this Script into your local Roblox Plugins folder, or run it from Plugin Debugging.

local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local AssetService = game:GetService("AssetService")

local TOOLBAR_NAME = "ROBLOSX TOOLS"
local WIDGET_ID = "ROBLOSXTOOLSPhotobooth"
local EXPORT_FOLDER = "_MultiPhotoboothExports"
local PREVIEW_FOLDER = "_MultiPhotoboothPreview"

local SETTINGS = {
	yaw = 45,
	pitch = 25,
	fov = 70,
	bright = 160,
	panX = 0,
	panY = 0,
	outline = true,
	outlineColor = Color3.fromRGB(255, 255, 255),
	outlineThickness = 3,
	shadow = true,
	shadowColor = Color3.fromRGB(0, 0, 0),
	shadowOpacity = 0.75,
	shadowDistance = 4,
	shadowBlur = 6,
	innerShadow = true,
	innerShadowOpacity = 0.75,
	innerShadowDistance = 4,
	innerShadowBlur = 6,
	innerAngle = 225,
}

local PRESETS = {
	Front = { yaw = 0, pitch = 0 },
	Side = { yaw = 90, pitch = 0 },
	Iso = { yaw = 45, pitch = 25 },
	["3/4"] = { yaw = 35, pitch = 15 },
}

local COLORS = {
	Color3.fromRGB(0, 0, 0),
	Color3.fromRGB(255, 255, 255),
	Color3.fromRGB(237, 66, 69),
	Color3.fromRGB(18, 136, 236),
	Color3.fromRGB(245, 197, 24),
	Color3.fromRGB(33, 168, 83),
}

local toolbar = plugin:CreateToolbar(TOOLBAR_NAME)
local button = toolbar:CreateButton("ROBLOSX TOOLS", "Create editable item icons from selected models", "")
button.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Float,
	false,
	false,
	872,
	840,
	520,
	420
)

local widget = plugin:CreateDockWidgetPluginGui(WIDGET_ID, widgetInfo)
widget.Title = "ROBLOSX TOOLS v2.12"
widget.Name = "MultiPhotobooth"

local root = Instance.new("Frame")
root.BackgroundColor3 = Color3.fromRGB(31, 31, 31)
root.BorderSizePixel = 0
root.Size = UDim2.fromScale(1, 1)
root.Parent = widget

local top = Instance.new("Frame")
top.BackgroundColor3 = Color3.fromRGB(18, 18, 18)
top.BorderSizePixel = 0
top.Size = UDim2.new(1, 0, 0, 69)
top.Parent = root

local tabs = Instance.new("Frame")
tabs.BackgroundTransparency = 1
tabs.Position = UDim2.fromOffset(8, 8)
tabs.Size = UDim2.new(1, -16, 0, 34)
tabs.Parent = top

local content = Instance.new("Frame")
content.BackgroundColor3 = Color3.fromRGB(35, 35, 35)
content.BorderSizePixel = 0
content.Position = UDim2.fromOffset(0, 69)
content.Size = UDim2.new(1, 0, 1, -119)
content.Parent = root

local footer = Instance.new("Frame")
footer.BackgroundColor3 = Color3.fromRGB(15, 15, 15)
footer.BorderSizePixel = 0
footer.Position = UDim2.new(0, 0, 1, -50)
footer.Size = UDim2.new(1, 0, 0, 50)
footer.Parent = root

local cameraPage = Instance.new("Frame")
cameraPage.BackgroundTransparency = 1
cameraPage.Size = UDim2.fromScale(1, 1)
cameraPage.Parent = content

local effectsPage = Instance.new("Frame")
effectsPage.BackgroundTransparency = 1
effectsPage.Size = UDim2.fromScale(1, 1)
effectsPage.Visible = false
effectsPage.Parent = content

local cards = Instance.new("ScrollingFrame")
cards.BackgroundTransparency = 1
cards.BorderSizePixel = 0
cards.Position = UDim2.fromOffset(10, 10)
cards.Size = UDim2.new(1, -20, 1, -20)
cards.CanvasSize = UDim2.fromOffset(0, 0)
cards.ScrollBarThickness = 8
cards.Parent = cameraPage

local cardLayout = Instance.new("UIGridLayout")
cardLayout.CellSize = UDim2.fromOffset(188, 222)
cardLayout.CellPadding = UDim2.fromOffset(14, 14)
cardLayout.SortOrder = Enum.SortOrder.LayoutOrder
cardLayout.Parent = cards

local selectedModels = {}
local viewportByModel = {}
local activeTab = "Camera"

local function mkText(parent, text, pos, size, color, align)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Gotham
	label.Text = text
	label.TextColor3 = color or Color3.fromRGB(210, 210, 210)
	label.TextSize = 12
	label.TextXAlignment = align or Enum.TextXAlignment.Left
	label.Position = pos
	label.Size = size
	label.Parent = parent
	return label
end

local function mkButton(parent, text, pos, size, color)
	local b = Instance.new("TextButton")
	b.AutoButtonColor = true
	b.BackgroundColor3 = color or Color3.fromRGB(64, 64, 64)
	b.BorderSizePixel = 0
	b.Font = Enum.Font.GothamMedium
	b.Text = text
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.TextSize = 12
	b.Position = pos
	b.Size = size
	b.Parent = parent
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 4)
	corner.Parent = b
	return b
end

local function mkToggle(parent, text, pos, get, set)
	mkText(parent, text, pos, UDim2.fromOffset(68, 22), Color3.fromRGB(120, 120, 120))
	local b = mkButton(parent, "", pos + UDim2.fromOffset(70, 0), UDim2.fromOffset(40, 22), Color3.fromRGB(70, 70, 70))
	local knob = Instance.new("Frame")
	knob.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	knob.BorderSizePixel = 0
	knob.Size = UDim2.fromOffset(18, 18)
	knob.Position = UDim2.fromOffset(2, 2)
	knob.Parent = b
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(1, 0)
	c.Parent = knob
	local function refresh()
		knob.Position = get() and UDim2.fromOffset(20, 2) or UDim2.fromOffset(2, 2)
	end
	b.MouseButton1Click:Connect(function()
		set(not get())
		refresh()
	end)
	refresh()
	return b
end

local function clearChildren(frame, keepLayout)
	for _, child in ipairs(frame:GetChildren()) do
		if not keepLayout or not child:IsA("UIGridLayout") then
			child:Destroy()
		end
	end
end

local function getBounds(model)
	local cf, size
	if model:IsA("Model") then
		cf, size = model:GetBoundingBox()
	elseif model:IsA("BasePart") then
		cf, size = model.CFrame, model.Size
	end
	return cf or CFrame.new(), size or Vector3.one
end

local function fitCamera(camera, model)
	local _, size = getBounds(model)
	local maxAxis = math.max(size.X, size.Y, size.Z, 1)
	local yaw = math.rad(SETTINGS.yaw)
	local pitch = math.rad(SETTINGS.pitch)
	local distance = maxAxis * (1.45 + SETTINGS.fov / 70)
	local offset = CFrame.Angles(0, yaw, 0) * CFrame.Angles(pitch, 0, 0)
	local pos = offset:VectorToWorldSpace(Vector3.new(0, maxAxis * 0.12, distance))
	camera.FieldOfView = SETTINGS.fov
	camera.CFrame = CFrame.lookAt(pos + Vector3.new(SETTINGS.panX / 25, SETTINGS.panY / 25, 0), Vector3.new(SETTINGS.panX / 25, SETTINGS.panY / 25, 0))
end

local function cloneForViewport(model)
	local clone = model:Clone()
	local origin = Instance.new("WorldModel")
	clone.Parent = origin
	local cf = select(1, getBounds(clone))
	for _, part in ipairs(clone:GetDescendants()) do
		if part:IsA("BasePart") then
			part.Anchored = true
			part.CastShadow = SETTINGS.shadow
		end
	end
	clone:PivotTo(CFrame.new() * cf:Inverse() * clone:GetPivot())
	return origin, clone
end

local function updateViewports()
	for model, viewport in pairs(viewportByModel) do
		if viewport.Parent then
			local world = viewport:FindFirstChildOfClass("WorldModel")
			local camera = viewport.CurrentCamera
			if world and camera then
				local clone = world:FindFirstChild(model.Name)
				if clone then
					fitCamera(camera, clone)
					viewport.Ambient = Color3.fromRGB(SETTINGS.bright, SETTINGS.bright, SETTINGS.bright)
					viewport.LightColor = Color3.fromRGB(255, 255, 255)
					viewport.LightDirection = Vector3.new(-1, -1, -1)
				end
			end
		end
	end
end

local function addCard(model, index)
	local card = Instance.new("Frame")
	card.BackgroundColor3 = Color3.fromRGB(55, 55, 55)
	card.BorderSizePixel = 0
	card.LayoutOrder = index
	card.Parent = cards
	Instance.new("UICorner", card).CornerRadius = UDim.new(0, 5)

	local viewport = Instance.new("ViewportFrame")
	viewport.BackgroundColor3 = Color3.fromRGB(16, 16, 16)
	viewport.BorderSizePixel = 0
	viewport.Position = UDim2.fromOffset(2, 2)
	viewport.Size = UDim2.new(1, -4, 0, 182)
	viewport.Parent = card
	Instance.new("UICorner", viewport).CornerRadius = UDim.new(0, 4)

	local camera = Instance.new("Camera")
	camera.Parent = viewport
	viewport.CurrentCamera = camera

	local world = cloneForViewport(model)
	world.Parent = viewport
	viewportByModel[model] = viewport
	fitCamera(camera, world:FindFirstChild(model.Name) or world:GetChildren()[1])

	mkText(card, model.Name, UDim2.new(0, 0, 1, -32), UDim2.new(1, 0, 0, 22), Color3.fromRGB(230, 230, 230), Enum.TextXAlignment.Center)
end

local function refreshSelection()
	selectedModels = {}
	viewportByModel = {}
	clearChildren(cards, true)
	for _, item in ipairs(Selection:Get()) do
		if item:IsA("Model") or item:IsA("BasePart") then
			table.insert(selectedModels, item)
		end
	end
	for index, model in ipairs(selectedModels) do
		addCard(model, index)
	end
	cards.CanvasSize = UDim2.fromOffset(0, math.ceil(#selectedModels / 4) * 236)
end

local function captureViewport(viewport)
	if viewport.CaptureSnapshotAsync then
		local ok, content = pcall(function()
			return viewport:CaptureSnapshotAsync()
		end)
		if ok then
			return content
		end
	end
	return nil
end

local function createEditableImageFromContent(content)
	if not content or not AssetService.CreateEditableImageAsync then
		return nil
	end
	local ok, editable = pcall(function()
		return AssetService:CreateEditableImageAsync(content)
	end)
	return ok and editable or nil
end

local function exportOne(model)
	local viewport = viewportByModel[model]
	if not viewport then
		return
	end
	local folder = workspace:FindFirstChild(EXPORT_FOLDER) or Instance.new("Folder")
	folder.Name = EXPORT_FOLDER
	folder.Parent = workspace

	local content = captureViewport(viewport)
	local editable = createEditableImageFromContent(content)

	local plane = Instance.new("Part")
	plane.Name = model.Name .. "_Icon"
	plane.Anchored = true
	plane.Size = Vector3.new(4, 4, 0.05)
	plane.CFrame = CFrame.new(#folder:GetChildren() * 4.5, 10, 0)
	plane.Color = Color3.fromRGB(163, 162, 165)
	plane.Material = Enum.Material.Plastic
	plane.Parent = folder

	local surface = Instance.new("SurfaceGui")
	surface.Name = "IconSurface"
	surface.Face = Enum.NormalId.Front
	surface.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	surface.PixelsPerStud = 128
	surface.Parent = plane

	local image = Instance.new("ImageLabel")
	image.Name = "ImageLabel"
	image.BackgroundTransparency = 1
	image.Size = UDim2.fromScale(1, 1)
	if content then
		pcall(function()
			image.ImageContent = content
		end)
	end
	image.Parent = surface

	if editable then
		local holder = Instance.new("ObjectValue")
		holder.Name = "EditableImage"
		holder.Value = editable
		holder.Parent = plane
	end

	plane:SetAttribute("PhotoboothSource", model:GetFullName())
	plane:SetAttribute("Yaw", SETTINGS.yaw)
	plane:SetAttribute("Pitch", SETTINGS.pitch)
	plane:SetAttribute("FOV", SETTINGS.fov)
	plane:SetAttribute("Outline", SETTINGS.outline)
	plane:SetAttribute("OutlineThickness", SETTINGS.outlineThickness)
	plane:SetAttribute("Shadow", SETTINGS.shadow)
end

local function captureAll()
	refreshSelection()
	updateViewports()
end

local function exportAll()
	ChangeHistoryService:SetWaypoint("Before Multi Photobooth Export")
	for _, model in ipairs(selectedModels) do
		exportOne(model)
	end
	ChangeHistoryService:SetWaypoint("After Multi Photobooth Export")
end

local function switchTab(tab)
	activeTab = tab
	cameraPage.Visible = tab == "Camera"
	effectsPage.Visible = tab == "Effects"
	for _, child in ipairs(tabs:GetChildren()) do
		if child:IsA("TextButton") then
			child.BackgroundColor3 = child.Text == tab and Color3.fromRGB(18, 136, 236) or Color3.fromRGB(64, 64, 64)
		end
	end
end

local cameraTab = mkButton(tabs, "Camera", UDim2.fromOffset(0, 0), UDim2.fromOffset(103, 30), Color3.fromRGB(18, 136, 236))
local effectsTab = mkButton(tabs, "Effects", UDim2.fromOffset(110, 0), UDim2.fromOffset(103, 30), Color3.fromRGB(64, 64, 64))
cameraTab.MouseButton1Click:Connect(function() switchTab("Camera") end)
effectsTab.MouseButton1Click:Connect(function() switchTab("Effects") end)

mkText(top, "Preset:", UDim2.fromOffset(10, 52), UDim2.fromOffset(64, 16), Color3.fromRGB(120, 120, 120))
local presetX = 78
for name, preset in pairs(PRESETS) do
	local b = mkButton(top, name, UDim2.fromOffset(presetX, 44), UDim2.fromOffset(82, 30), Color3.fromRGB(64, 64, 64))
	b.MouseButton1Click:Connect(function()
		SETTINGS.yaw = preset.yaw
		SETTINGS.pitch = preset.pitch
		updateViewports()
	end)
	presetX += 89
end

local function slider(parent, name, y, min, max, key, suffix)
	mkText(parent, name, UDim2.fromOffset(10, y), UDim2.fromOffset(54, 22), Color3.fromRGB(125, 125, 125))
	local label = mkText(parent, tostring(SETTINGS[key]) .. (suffix or ""), UDim2.new(1, -64, 0, y), UDim2.fromOffset(54, 22), Color3.fromRGB(220, 220, 220), Enum.TextXAlignment.Right)
	local bar = Instance.new("TextButton")
	bar.Text = ""
	bar.BackgroundColor3 = Color3.fromRGB(76, 76, 76)
	bar.BorderSizePixel = 0
	bar.Position = UDim2.fromOffset(65, y + 8)
	bar.Size = UDim2.new(1, -115, 0, 6)
	bar.Parent = parent
	Instance.new("UICorner", bar).CornerRadius = UDim.new(1, 0)
	local fill = Instance.new("Frame")
	fill.BackgroundColor3 = Color3.fromRGB(18, 136, 236)
	fill.BorderSizePixel = 0
	fill.Size = UDim2.fromScale((SETTINGS[key] - min) / (max - min), 1)
	fill.Parent = bar
	Instance.new("UICorner", fill).CornerRadius = UDim.new(1, 0)
	local function setFromX(x)
		local alpha = math.clamp((x - bar.AbsolutePosition.X) / bar.AbsoluteSize.X, 0, 1)
		SETTINGS[key] = math.floor(min + (max - min) * alpha + 0.5)
		fill.Size = UDim2.fromScale(alpha, 1)
		label.Text = tostring(SETTINGS[key]) .. (suffix or "")
		updateViewports()
	end
	bar.MouseButton1Down:Connect(function(x)
		setFromX(x)
	end)
	return bar
end

slider(top, "Yaw", 89, -180, 180, "yaw", " deg")
slider(top, "Pitch", 119, -90, 90, "pitch", " deg")
slider(top, "FOV", 149, 20, 90, "fov", " deg")
slider(top, "Bright", 179, 0, 255, "bright", "")
slider(top, "Pan X", 209, -100, 100, "panX", "")
slider(top, "Pan Y", 239, -100, 100, "panY", "")
top.Size = UDim2.new(1, 0, 0, 294)
content.Position = UDim2.fromOffset(0, 294)
content.Size = UDim2.new(1, 0, 1, -344)

local function effectRow(y, label, enabledKey, colorKey, opacityKey, distKey, blurKey)
	mkToggle(effectsPage, label, UDim2.fromOffset(10, y), function() return SETTINGS[enabledKey] end, function(v) SETTINGS[enabledKey] = v end)
	local x = 126
	for _, color in ipairs(COLORS) do
		local swatch = mkButton(effectsPage, "", UDim2.fromOffset(x, y), UDim2.fromOffset(18, 18), color)
		swatch.MouseButton1Click:Connect(function()
			SETTINGS[colorKey] = color
		end)
		x += 24
	end
	if opacityKey then
		slider(effectsPage, "Op:", y + 26, 0, 100, opacityKey, "%")
	end
	if distKey then
		slider(effectsPage, "D:", y + 56, 0, 16, distKey, "px")
	end
	if blurKey then
		slider(effectsPage, "B:", y + 86, 0, 24, blurKey, "px")
	end
end

effectRow(10, "Outline", "outline", "outlineColor", nil, nil, nil)
local minus = mkButton(effectsPage, "-", UDim2.fromOffset(310, 10), UDim2.fromOffset(24, 24), Color3.fromRGB(80, 80, 80))
local thick = mkText(effectsPage, tostring(SETTINGS.outlineThickness), UDim2.fromOffset(342, 10), UDim2.fromOffset(16, 24), Color3.fromRGB(220, 220, 220), Enum.TextXAlignment.Center)
local plus = mkButton(effectsPage, "+", UDim2.fromOffset(366, 10), UDim2.fromOffset(24, 24), Color3.fromRGB(80, 80, 80))
minus.MouseButton1Click:Connect(function() SETTINGS.outlineThickness = math.max(0, SETTINGS.outlineThickness - 1); thick.Text = tostring(SETTINGS.outlineThickness) end)
plus.MouseButton1Click:Connect(function() SETTINGS.outlineThickness += 1; thick.Text = tostring(SETTINGS.outlineThickness) end)
effectRow(74, "Shadow", "shadow", "shadowColor", "shadowOpacity", "shadowDistance", "shadowBlur")
effectRow(168, "In.Shadow", "innerShadow", "shadowColor", "innerShadowOpacity", "innerShadowDistance", "innerShadowBlur")
slider(effectsPage, "In.Angle:", 272, 0, 360, "innerAngle", " deg")

local status = mkText(footer, "0 model(s) selected", UDim2.fromOffset(14, 14), UDim2.fromOffset(180, 22), Color3.fromRGB(140, 140, 140))
local capture = mkButton(footer, "Capture All", UDim2.new(1, -376, 0, 8), UDim2.fromOffset(182, 34), Color3.fromRGB(18, 136, 236))
local export = mkButton(footer, "Export All", UDim2.new(1, -182, 0, 8), UDim2.fromOffset(172, 34), Color3.fromRGB(33, 168, 83))

capture.MouseButton1Click:Connect(function()
	captureAll()
	status.Text = tostring(#selectedModels) .. " model(s) selected"
end)

export.MouseButton1Click:Connect(function()
	exportAll()
	status.Text = tostring(#selectedModels) .. " exported to Workspace/" .. EXPORT_FOLDER
end)

Selection.SelectionChanged:Connect(function()
	refreshSelection()
	status.Text = tostring(#selectedModels) .. " model(s) selected"
end)

button.Click:Connect(function()
	widget.Enabled = not widget.Enabled
	if widget.Enabled then
		refreshSelection()
		status.Text = tostring(#selectedModels) .. " model(s) selected"
	end
end)

refreshSelection()
