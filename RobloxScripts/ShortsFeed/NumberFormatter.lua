local NumberFormatter = {}

function NumberFormatter.Format(value)
	local amount = math.max(0, tonumber(value) or 0)
	if amount >= 1_000_000 then
		local text = string.format("%.1fM", amount / 1_000_000)
		return text:gsub("%.0M", "M")
	elseif amount >= 1_000 then
		local text = string.format("%.1fK", amount / 1_000)
		return text:gsub("%.0K", "K")
	end
	return tostring(math.floor(amount + 0.5))
end

return NumberFormatter
