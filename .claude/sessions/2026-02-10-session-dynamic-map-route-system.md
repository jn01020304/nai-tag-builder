# Session Summary: Dynamic Map Route System Implementation

Date: 2026-02-10
Summary: Implemented multi-turn journey system for Dynamic_Map.lua with weighted activity progression, route state management, and comprehensive test suite. Core functions complete but integration with chat handlers pending.

## 1. Executive Summary

Successfully implemented the Route System for Dynamic_Map.lua (Phase 3.1), replacing instant teleportation with multi-segment journeys. The system features weighted activity selection, progress tracking, and HTML UI with progress bars. Created comprehensive test suite (Dynamic_Map_Test.lua) with 20 unit tests covering all journey lifecycle scenarios. **Critical**: Main integration pending—current Dynamic_Map.lua requires updates to `onInput`, `onOutput`, and `moveTo_` handlers to activate the Route System.

## 2. Technical Changes & Decisions

### 2.1 Core Architecture
Component: Route System (Dynamic_Map.lua)
Rationale: Original design had instant teleportation (`applyMovement` directly set position). Route System enables turn-by-turn travel with activities, creating gameplay depth and narrative opportunities during journeys.

Design Decisions:
- Distance Calculation: `route.distance = remoteness_A + remoteness_B` (sum of place remoteness values = number of journey segments/turns)
- Movement Authority: LLM/User controls character movement via text patterns `[PlaceName → PlaceName]` (extracted by `extractMovement`). Engine executes/validates only.
- Journey State Storage: `characterPosition.locationType = "route"` with additional fields: `routeFrom`, `routeTo`, `progress`, `totalDistance`, `currentActivity`
- Movement Restriction: Only allowed when `locationType == "place"`. Movement commands during travel are rejected.
- Activity Selection: Weighted random selection per segment from route's `activityPool` (merged from both connected places)
- State Cleanup: All route-specific fields cleared on arrival to prevent data leakage

Files Affected:
- `d:\Archive-Risu\RisuAI\project\Dynamic_Map.lua` (lines 27-45, 571-670, 1016-1021, 1034-1075)
- `d:\Archive-Risu\RisuAI\project\Dynamic_Map_Test.lua` (full rewrite)

### 2.2 Activity System
Addition: ACTIVITY_DEFINITIONS constant (line 27-45)

Structure:
```lua
local ACTIVITY_DEFINITIONS = {
    camp = {weight = 10, description = "Setting up camp"},
    rest = {weight = 8, description = "Taking a rest"},
    forage = {weight = 6, description = "Foraging for supplies"},
    -- ... 10 total activities
}
```

Rationale: Weighted selection ensures variety while maintaining narrative coherence. Common activities (camp, rest) have higher weights. Rare events (encounter, discovery) have low weights (2-3).

### 2.3 Journey State Management
New Function: `startJourney(world, fromId, toId)`
Location: Lines 571-610
Purpose: Initiates multi-turn journey

Validation:
1. Character must be at a place (`locationType == "place"`)
2. `fromId` must match current position
3. Places must be adjacent (route must exist)
4. Both place IDs must exist

State Changes:
```lua
world.characterPosition = {
    locationType = "route",
    routeFrom = fromId,
    routeTo = toId,
    progress = 0,
    totalDistance = route.distance,
    currentActivity = selectRouteActivity(world, fromId, toId)
}
```

Return: `{success=true, activity=string, distance=number}` or `{success=false, error=string}`

---

New Function: `advanceJourney(world)`
Location: Lines 612-650
Purpose: Progress journey by 1 segment per turn

Logic:
1. Skip if `locationType ~= "route"`
2. Increment `progress`
3. If `progress >= totalDistance`: Arrival
   - Set `locationType = "place"`, `placeId = routeTo`
   - Clear all route fields (`routeFrom`, `routeTo`, `progress`, `totalDistance`, `currentActivity`)
   - Return `{arrived=true, placeId=string}`
4. Else: Select new activity for next segment
   - Return `{arrived=false, activity=string, progress=number, total=number}`

---

Modified Function: `applyMovement(world, movement)`
Location: Lines 652-670
Original Behavior: Direct position update (instant teleport)
New Behavior: Calls `startJourney(world, movement.from, movement.to)`

Breaking Change: Returns journey start state instead of direct position update. **Requires integration** with `onInput`/`onOutput` handlers.

### 2.4 HTML UI Updates
Location: `generateMapHtml()` lines 1016-1021, 1034-1075

CSS Additions (line 1016-1021):
```css
.x-risu-dm-destination { color: #3b82f6; font-weight: bold; } /* Blue highlight for destination */
.x-risu-dm-travel { /* Orange banner for travel status */ }
.x-risu-dm-travel-bar { /* Progress bar container (gray) */ }
.x-risu-dm-travel-fill { /* Progress bar fill (orange gradient) */ }
```

Position Display (line 1037-1058):
- At Place: "📍 You are at [PlaceName]"
- During Travel:

  ```
  🚶 Traveling: [FromPlace] → [ToPlace]
  Activity: [CurrentActivity]
  Segment: [progress]/[totalDistance] ([percentage]%)
  [Progress Bar]
  ```

Place List (line 1060-1075):
- Highlights destination with 🎯 icon when `locationType == "route"`
- Hides move buttons during travel (no buttons rendered when `getReachablePlaces()` returns empty array)

## 3. Code Implementation

### 3.1 Activity Selection (Weighted Random)
```lua
-- Location: Dynamic_Map.lua lines 571-590
local function selectRouteActivity(world, fromId, toId)
    local route = getRoute(world, fromId, toId)
    if not route then
        return "traveling"
    end

    local pool = route.activityPool or {}
    if #pool == 0 then
        return "traveling"
    end

    -- Calculate total weight
    local totalWeight = 0
    for _, actName in ipairs(pool) do
        local actDef = ACTIVITY_DEFINITIONS[actName]
        if actDef then
            totalWeight = totalWeight + actDef.weight
        end
    end

    -- Weighted random selection
    local roll = math.random() * totalWeight
    local累計 = 0
    for _, actName in ipairs(pool) do
        local actDef = ACTIVITY_DEFINITIONS[actName]
        if actDef then
            累計 = 累計 + actDef.weight
            if roll <= 累計 then
                return actDef.description
            end
        end
    end

    return pool[1] and ACTIVITY_DEFINITIONS[pool[1]].description or "traveling"
end
```

### 3.2 Journey Advancement Logic
```lua
-- Location: Dynamic_Map.lua lines 612-650
local function advanceJourney(world)
    local pos = world.characterPosition
    if pos.locationType ~= "route" then
        return {arrived = false, message = "Not traveling"}
    end

    pos.progress = pos.progress + 1

    -- Check arrival
    if pos.progress >= pos.totalDistance then
        local destId = pos.routeTo
        local destPlace = world.places[destId]

        -- Update position to destination
        world.characterPosition = {
            locationType = "place",
            placeId = destId
        }

        return {
            arrived = true,
            placeId = destId,
            placeName = destPlace and destPlace.name or "Unknown"
        }
    else
        -- Continue journey - select new activity
        pos.currentActivity = selectRouteActivity(world, pos.routeFrom, pos.routeTo)

        return {
            arrived = false,
            activity = pos.currentActivity,
            progress = pos.progress,
            total = pos.totalDistance
        }
    end
end
```

### 3.3 Movement Extraction Pattern
```lua
-- Location: Dynamic_Map.lua lines 498-535
-- Movement Pattern: [PlaceName → PlaceName] or [PlaceName -> PlaceName]
-- Supports both Unicode arrow (→) and ASCII arrow (->)

local function extractMovement(world, text)
    -- Try Unicode arrow first
    local pattern = "%[([^%]]+)%s*→%s*([^%]]+)%]"
    local from, to = text:match(pattern)

    -- Fallback to ASCII arrow
    if not from then
        pattern = "%[([^%]]+)%s*%-%>%s*([^%]]+)%]"
        from, to = text:match(pattern)
    end

    if not from or not to then
        return nil
    end

    -- Trim whitespace and normalize
    from = from:match("^%s*(.-)%s*$")
    to = to:match("^%s*(.-)%s*$")

    -- Find place IDs by name
    local fromId, toId
    for id, place in pairs(world.places) do
        if place.name == from then fromId = id end
        if place.name == to then toId = id end
    end

    if fromId and toId then
        return {from = fromId, to = toId}
    end

    return nil
end
```

## 4. Test Suite (Dynamic_Map_Test.lua)

### 4.1 Unit Tests (20 Total)
Location: `d:\Archive-Risu\RisuAI\project\Dynamic_Map_Test.lua`

Test Coverage:
- T01-T05: Core functions (createExampleWorld, getRoute, selectRouteActivity, startJourney validation)
- T06-T09: Journey progression (single step, multi-step, full journey, arrival state cleanup)
- T10-T13: Movement system (applyMovement, extractMovement with Unicode/ASCII arrows)
- T14-T16: State management (getReachablePlaces during travel, serialization roundtrip, consecutive journeys)
- T17-T20: Data integrity (ACTIVITY_DEFINITIONS coverage, position cleanup, quest tick order, world save bug)

Example Test:
```lua
-- T07: Full Journey Simulation
local function testFullJourney()
    local world = createExampleWorld()
    local result = startJourney(world, "village", "ruins")
    if not result.success then
        return false, "Journey start failed"
    end

    for turn = 1, result.distance do
        local advance = advanceJourney(world)
        if turn < result.distance and advance.arrived then
            return false, "Arrived too early at turn " .. turn
        end
        if turn == result.distance and not advance.arrived then
            return false, "Did not arrive after " .. result.distance .. " turns"
        end
    end

    if world.characterPosition.locationType ~= "place" then
        return false, "Position not cleaned up after arrival"
    end

    return true, "Full journey completed successfully"
end
```

### 4.2 Interactive Test Commands
Commands (executed in RisuAI chat):
- `/routetest` - Run 20 unit tests, display pass/fail summary
- `/journeytest` - Simulate full journey with turn-by-turn log (activities, reachable places, arrival)
- `/htmltest` - Render HTML in 3 states (at place, route start, mid-travel) + serialization preview
- `/resettest` - Reset world to initial state

HTML Rendering Test Output:
```
State 1: At Village
[HTML with move buttons for Forest and Ruins]

State 2: Journey Start (Village → Ruins)
[HTML with travel banner, activity, progress 0/2]

State 3: Mid-Journey
[HTML with progress bar at 50%, no move buttons]
```

## 5. Resolved Issues

### 5.1 wasmoon String Encoding (Historical)
Issue: Lua `\xNN` byte escapes produce invalid UTF-8 in wasmoon
Solution: Use HTML entities (`&#x1F4CD;`) or direct UTF-8 characters
Context: Not directly related to Route System, but relevant for emoji rendering in HTML

### 5.2 Movement Button State
Issue: Move buttons should not appear during travel
Solution: `getReachablePlaces()` returns empty array when `locationType == "route"`. UI renders buttons only for non-empty reachable places.

### 5.3 State Cleanup on Arrival
Issue: Route state fields (`routeFrom`, `routeTo`, etc.) could persist after arrival
Solution: `advanceJourney()` explicitly clears all route fields on arrival:
```lua
world.characterPosition = {
    locationType = "place",
    placeId = destId
}
-- All route fields removed (not set to nil, object replaced)
```

## 6. Critical Pending Work

### 6.1 Integration with Chat Handlers (HIGH PRIORITY)
Current State: Route System functions are complete but **not called** by main chat loop.

Required Changes:

#### A. Update `onInput` (Turn Start Handler)
Location: Dynamic_Map.lua `onInput` callback

Current Code (approximate):
```lua
listenEdit("onInput", async(function(tid, data, meta)
    local world = loadWorld(tid)
    if not world then return data end

    -- Extract movement from user input
    local movement = extractMovement(world, data)
    if movement then
        applyMovement(world, movement)  -- OLD: instant teleport
    end

    tickQuests(world)  -- BUG: runs before arrival check
    saveWorld(tid, world)

    return data
end))
```

Required Updates:
1. Add `advanceJourney()` call at turn start (before movement extraction)
2. Fix world save bug: Save even when no movement (tickQuests modifies world)
3. Fix quest tick order: Call `resolveQuestsAtLocation()` BEFORE `tickQuests()` to prevent unfair expiration on arrival turn

New Code (proposed):
```lua
listenEdit("onInput", async(function(tid, data, meta)
    local world = loadWorld(tid)
    if not world then return data end

    -- [NEW] Advance ongoing journey at turn start
    local journeyResult = advanceJourney(world)
    if journeyResult.arrived then
        alertNormal(tid, "You have arrived at " .. journeyResult.placeName .. "!")
        -- [NEW] Resolve quests BEFORE tick (prevent unfair expiration on arrival)
        resolveQuestsAtLocation(world, journeyResult.placeId)
    end

    -- Extract movement from user input (only if at place)
    if world.characterPosition.locationType == "place" then
        local movement = extractMovement(world, data)
        if movement then
            local startResult = applyMovement(world, movement)  -- [CHANGED] Now calls startJourney
            if startResult.success then
                alertNormal(tid, "Journey started: " .. startResult.activity)
            else
                alertNormal(tid, "Cannot travel: " .. startResult.error)
            end
        end
    end

    -- Tick quests (expires old quests, generates new ones)
    tickQuests(world)

    -- [NEW] Always save world (even without movement, tickQuests modifies it)
    saveWorld(tid, world)

    return data
end))
```

#### B. Update `onOutput` (AI Response Handler)
Location: Dynamic_Map.lua `onOutput` callback

Current Code (approximate):
```lua
listenEdit("onOutput", async(function(tid, data, meta)
    local world = loadWorld(tid)
    if not world then return data end

    -- Extract movement from AI response
    local movement = extractMovement(world, data)
    if movement then
        applyMovement(world, movement)
        saveWorld(tid, world)
    end

    return data
end))
```

Required Updates:
1. Only extract movement when `locationType == "place"` (prevent movement commands during travel)

New Code (proposed):
```lua
listenEdit("onOutput", async(function(tid, data, meta)
    local world = loadWorld(tid)
    if not world then return data end

    -- [NEW] Only process movement when at a place (not during travel)
    if world.characterPosition.locationType == "place" then
        local movement = extractMovement(world, data)
        if movement then
            local startResult = applyMovement(world, movement)  -- [CHANGED] Now calls startJourney
            if startResult.success then
                saveWorld(tid, world)
            end
        end
    end

    return data
end))
```

#### C. Update `moveTo_` Button Handler
Location: Dynamic_Map.lua `onButtonClick` callback

Current Code (approximate):
```lua
if code:sub(1, 7) == "moveTo_" then
    local targetId = code:sub(8)
    world.characterPosition = {
        locationType = "place",
        placeId = targetId
    }
    saveWorld(tid, world)
    reloadDisplay(tid)
end
```

Required Updates:
1. Call `startJourney()` instead of direct position update
2. Handle journey start result (success/error messages)

New Code (proposed):
```lua
if code:sub(1, 7) == "moveTo_" then
    local targetId = code:sub(8)
    local currentId = world.characterPosition.placeId

    -- [NEW] Start journey instead of instant teleport
    local result = startJourney(world, currentId, targetId)

    if result.success then
        saveWorld(tid, world)
        reloadDisplay(tid)
        alertNormal(tid, "Journey started: " .. result.activity .. " (" .. result.distance .. " segments)")
    else
        alertNormal(tid, "Cannot start journey: " .. result.error)
    end
end
```

#### D. Update `printWorldInfo`
Location: Dynamic_Map.lua `printWorldInfo()` function

Current Code: Only displays place information

Required Updates: Add travel status display when `locationType == "route"`

New Code (proposed):
```lua
local function printWorldInfo(world)
    local info = "=== WORLD STATE ===\n"

    local pos = world.characterPosition
    if pos.locationType == "place" then
        local place = world.places[pos.placeId]
        info = info .. "Location: " .. (place and place.name or "Unknown") .. "\n"
    elseif pos.locationType == "route" then
        -- [NEW] Travel status
        local fromPlace = world.places[pos.routeFrom]
        local toPlace = world.places[pos.routeTo]
        info = info .. "Traveling: " .. (fromPlace and fromPlace.name or "?") .. " → " .. (toPlace and toPlace.name or "?") .. "\n"
        info = info .. "Progress: " .. pos.progress .. "/" .. pos.totalDistance .. " segments\n"
        info = info .. "Activity: " .. pos.currentActivity .. "\n"
    end

    -- ... rest of function
end
```

### 6.2 Known Bugs to Fix

#### Bug 1: World Save Omission
Location: `onInput` handler
Issue: World only saved when movement occurs. `tickQuests()` modifies world (expires/generates quests) but changes lost if no movement.
Fix: Move `saveWorld(tid, world)` outside movement conditional (always save)

#### Bug 2: Quest Tick Order
Location: `onInput` handler
Issue: `tickQuests()` runs before arrival check. Quests can expire on the same turn character arrives, which is unfair.
Fix: Call `resolveQuestsAtLocation(world, placeId)` immediately after `advanceJourney()` reports arrival, BEFORE calling `tickQuests()`

Correct Order:
1. `advanceJourney()` - Character arrives at destination
2. `resolveQuestsAtLocation()` - Resolve quests at arrival location
3. `tickQuests()` - Tick all quests (expire old, generate new)

## 7. Next Steps (Action Items)

### Phase 1: Testing (Immediate)
- [ ] Load `Dynamic_Map_Test.lua` in RisuAI
- [ ] Run `/routetest` - Verify all 20 unit tests pass
- [ ] Run `/journeytest` - Verify turn-by-turn journey simulation works correctly
- [ ] Run `/htmltest` - Verify HTML rendering in all 3 states (at place, route start, mid-travel)
- [ ] Document test results (any failures indicate Route System logic bugs)

### Phase 2: Integration (High Priority)
- [ ] Update `onInput` handler in `Dynamic_Map.lua`:
  - [ ] Add `advanceJourney()` call at turn start
  - [ ] Add arrival notification
  - [ ] Call `resolveQuestsAtLocation()` before `tickQuests()` on arrival
  - [ ] Update movement extraction to only run when `locationType == "place"`
  - [ ] Change `applyMovement()` call to handle journey start result
  - [ ] Move `saveWorld()` outside conditional (always save)
- [ ] Update `onOutput` handler:
  - [ ] Add `locationType == "place"` check before movement extraction
  - [ ] Update `applyMovement()` call to handle journey start result
- [ ] Update `moveTo_` button handler:
  - [ ] Replace direct position update with `startJourney()` call
  - [ ] Add success/error handling and notifications
- [ ] Update `printWorldInfo()`:
  - [ ] Add travel status display for `locationType == "route"`

### Phase 3: Validation (Post-Integration)
- [ ] Test full journey in live chat (user types `[Village → Ruins]`)
- [ ] Verify `advanceJourney()` triggers automatically each turn
- [ ] Verify arrival notification appears
- [ ] Verify move buttons hidden during travel
- [ ] Verify quest resolution happens before tick on arrival
- [ ] Test button-based movement (click move buttons)
- [ ] Test consecutive journeys (arrive → immediately start new journey)

### Phase 4: Documentation (Final)
- [ ] Update `Dynamic_Map_Note.md` Section 3 with Route System implementation details
- [ ] Document callback execution order with Route System integration
- [ ] Add "Route System Usage Guide" for character card authors (how to use movement patterns, activities)
- [ ] Update troubleshooting section with common issues (movement during travel, quest tick order)

## 8. Technical Environment

Framework: wasmoon (Lua 5.4 in WebAssembly)
Encoding: UTF-8 (avoid `\xNN` escapes, use HTML entities or direct UTF-8)
Storage: `chat.scriptstate` (shared between Lua and CBS via `setChatVar`/`{{getvar}}`)
Callback Order: `onInput` → `editInput` → `editDisplay`(Input) → `onStart` → `editRequest` → `editOutput` → `onOutput` → `editDisplay`(Output)

Route System Callback Points:
- `onInput`: `advanceJourney()` (turn start), movement extraction (user input)
- `onOutput`: Movement extraction (AI response)
- `onButtonClick`: `moveTo_` handler (button-based movement)

## 9. File Manifest

Modified Files:
- `d:\Archive-Risu\RisuAI\project\Dynamic_Map.lua`
  - Lines 27-45: ACTIVITY_DEFINITIONS constant
  - Lines 571-670: Route System functions (selectRouteActivity, startJourney, advanceJourney, applyMovement replacement)
  - Lines 1016-1021: CSS additions for travel UI
  - Lines 1034-1075: HTML position display and place list updates

New Files:
- `d:\Archive-Risu\RisuAI\project\Dynamic_Map_Test.lua` (comprehensive test suite)

Pending Changes:
- `Dynamic_Map.lua` (onInput, onOutput, onButtonClick callbacks - integration not yet implemented)

## 10. References

Related Documentation:
- `d:\Archive-Risu\RisuAI\project\Dynamic_Map_Note.md` - Design document (Sections 1-11)
- `d:\Archive-Risu\RisuAI\Prompt_Ref\Dynamic_Map_Lorebook_Examples.md` - User setup guide
- `d:\Archive-Risu\RisuAI\CLAUDE.md` - RisuAI project guidelines (CBS, Lua API, callback order)

Key Patterns:
- Movement extraction: `[PlaceName → PlaceName]` or `[PlaceName -> PlaceName]`
- Journey state: `characterPosition.locationType = "route"` with `routeFrom`, `routeTo`, `progress`, `totalDistance`, `currentActivity`
- Activity selection: Weighted random from `ACTIVITY_DEFINITIONS` via route's `activityPool`
- Arrival cleanup: Full `characterPosition` object replacement (clears all route fields)

