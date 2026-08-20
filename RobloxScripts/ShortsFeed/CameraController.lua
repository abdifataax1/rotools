local Players = game:GetService("Players")
local ContextActionService = game:GetService("ContextActionService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Config = require(script.Parent.Config)
local player = Players.LocalPlayer

local CameraController = { Active = false }
local CONTROL_LOCK = "ShortsFeedControlLock"

local function sinkMovement()
	return Enum.ContextActionResult.Sink
end

local function controls()
	local ok, module = pcall(function()
		local playerScripts = player:WaitForChild("PlayerScripts")
		local playerModule = playerScripts:FindFirstChild("PlayerModule") or playerScripts:WaitForChild("PlayerModule", 2)
		if not playerModule then return nil end
		return require(playerModule):GetControls()
	end)
	return ok and module or nil
end

function CameraController:_cancelTween()
	if self.Tween then self.Tween:Cancel() self.Tween = nil end
end

function CameraController:Enter(cameraPoint)
	if not cameraPoint or not cameraPoint:IsA("BasePart") then return false, "CameraPoint is missing" end
	local camera = Workspace.CurrentCamera
	if not camera then return false, "CurrentCamera is missing" end
	self:_cancelTween()
	if not self.Active then
		self.Saved = { Type = camera.CameraType, Subject = camera.CameraSubject, CFrame = camera.CFrame, Focus = camera.Focus, FOV = camera.FieldOfView }
	end
	self.Active = true
	self.Target = cameraPoint
	self.Controls = self.Controls or controls()
	if self.Controls then
		self.Controls:Disable()
	else
		ContextActionService:BindActionAtPriority(CONTROL_LOCK, sinkMovement, false, Enum.ContextActionPriority.High.Value,
			Enum.KeyCode.W, Enum.KeyCode.A, Enum.KeyCode.S, Enum.KeyCode.D, Enum.KeyCode.Space,
			Enum.KeyCode.Thumbstick1, Enum.KeyCode.ButtonA)
	end
	camera.CameraType = Enum.CameraType.Scriptable
	self.Tween = TweenService:Create(camera, TweenInfo.new(Config.CameraTweenDuration, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut), {
		CFrame = cameraPoint.CFrame,
		Focus = cameraPoint.CFrame + cameraPoint.CFrame.LookVector * 12,
	})
	self.Tween:Play()
	return true
end

function CameraController:TransitionTo(cameraPoint)
	if not self.Active then return self:Enter(cameraPoint) end
	self.Target = cameraPoint
	self:_cancelTween()
	local camera = Workspace.CurrentCamera
	if not camera then return false end
	self.Tween = TweenService:Create(camera, TweenInfo.new(Config.CameraTweenDuration), { CFrame = cameraPoint.CFrame, Focus = cameraPoint.CFrame + cameraPoint.CFrame.LookVector * 12 })
	self.Tween:Play()
	return true
end

function CameraController:Restore(immediate)
	if not self.Active then return end
	self.Active = false
	self:_cancelTween()
	local camera = Workspace.CurrentCamera
	local saved = self.Saved
	local function finish()
		if camera and saved then
			camera.CameraType = saved.Type
			if saved.Subject and saved.Subject.Parent then camera.CameraSubject = saved.Subject end
			camera.FieldOfView = saved.FOV
		end
		if self.Controls then self.Controls:Enable() end
		ContextActionService:UnbindAction(CONTROL_LOCK)
		self.Saved = nil
	end
	if not camera or not saved or immediate then finish() return end
	camera.CameraType = Enum.CameraType.Scriptable
	self.Tween = TweenService:Create(camera, TweenInfo.new(Config.CameraTweenDuration, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut), { CFrame = saved.CFrame, Focus = saved.Focus, FieldOfView = saved.FOV })
	self.Tween.Completed:Once(finish)
	self.Tween:Play()
end

function CameraController:IsActive() return self.Active end

player.CharacterAdded:Connect(function()
	if CameraController.Active then CameraController:Restore(true) end
end)

return CameraController
