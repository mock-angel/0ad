function AttackDetection() {}

AttackDetection.prototype.Schema =
	"<a:help>Detects incoming attacks.</a:help>" +
	"<a:example/>" +
	"<element name='SuppressionTransferRange' a:help='Any attacks within this range in meters will replace the previous attack suppression'>" +
		"<ref name='positiveDecimal'/>" +
	"</element>" +
	"<element name='SuppressionRange' a:help='Other attacks within this range in meters will not be registered'>" +
		"<ref name='positiveDecimal'/>" +
	"</element>" +
	"<element name='SuppressionTime' a:help='Other attacks within this time in milliseconds will not be registered'>" +
		"<data type='positiveInteger'/>" +
	"</element>";

AttackDetection.prototype.Init = function()
{
	this.suppressionTime = +this.template.SuppressionTime;
	// Use squared distance to avoid sqrts
	this.suppressionTransferRangeSquared = +this.template.SuppressionTransferRange * +this.template.SuppressionTransferRange;
	this.suppressionRangeSquared = +this.template.SuppressionRange * +this.template.SuppressionRange;
	this.suppressedList = [];
};

AttackDetection.prototype.ActivateTimer = function()
{
	Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer).SetTimeout(this.entity, IID_AttackDetection, "HandleTimeout", this.suppressionTime);
};

AttackDetection.prototype.AddSuppression = function(event)
{
	this.suppressedList.push(event);
	this.ActivateTimer();
};

AttackDetection.prototype.UpdateSuppressionEvent = function(index, event)
{
	this.suppressedList[index] = event;
	this.ActivateTimer();
};

//// Message handlers ////

AttackDetection.prototype.OnGlobalAttacked = function(msg)
{
	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	var cmpOwnership = Engine.QueryInterface(msg.target, IID_Ownership);
	if (cmpOwnership.GetOwner() == cmpPlayer.GetPlayerID())
		Engine.PostMessage(msg.target, MT_MinimapPing);
};

//// External interface ////

AttackDetection.prototype.AttackAlert = function(target, attacker)
{
	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	var cmpTargetOwnership = Engine.QueryInterface(target, IID_Ownership);
	// Don't register attacks dealt against other players
	if (cmpTargetOwnership.GetOwner() != cmpPlayer.GetPlayerID())
		return;
	var cmpAttackerOwnership = Engine.QueryInterface(attacker, IID_Ownership);
	// Don't register attacks dealt by myself
	if (cmpAttackerOwnership.GetOwner() == cmpPlayer.GetPlayerID())
		return;
		
	// Since livestock can be attacked/gathered by other players
	// and generally are not so valuable as other units/buildings,
	// we have a lower priority notification for it, which can be
	// overriden by a regular one.
	var cmpTargetIdentity = Engine.QueryInterface(target, IID_Identity); 
	var targetIsDomesticAnimal = cmpTargetIdentity && cmpTargetIdentity.HasClass("Animal") && cmpTargetIdentity.HasClass("Domestic");

	var cmpPosition = Engine.QueryInterface(target, IID_Position);
	if (!cmpPosition || !cmpPosition.IsInWorld())
		return;
	var event = {
		"target": target,
		"position": cmpPosition.GetPosition(),
		"time": Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer).GetTime(),
		"targetIsDomesticAnimal": targetIsDomesticAnimal
	};

	// If we already have a low priority livestock event in suppressed list,
	// and now a more important target is attacked, we want to upgrade the
	// suppressed event and send the new notification
	var isPriorityIncreased = false;
	for (var i = 0; i < this.suppressedList.length; ++i)
	{
		var element = this.suppressedList[i];

		// If the new attack is within suppression distance of this element,
		// then check if the element should be updated and return
		var dist = SquaredDistance(element.position, event.position);
		if (dist >= this.suppressionRangeSquared)
			continue;

		isPriorityIncreased = element.targetIsDomesticAnimal && !targetIsDomesticAnimal;
		var isPriorityDescreased = !element.targetIsDomesticAnimal && targetIsDomesticAnimal;

		if (isPriorityIncreased
		    || (!isPriorityDescreased && dist < this.suppressionTransferRangeSquared))
			this.UpdateSuppressionEvent(i, event);

		// If priority has increased, exit the loop to send the upgraded notification below
		if (isPriorityIncreased)
			break;

		return;
	}

	// If priority has increased for an existing event, then we already have it
	// in the suppression list
	if (!isPriorityIncreased)
		this.AddSuppression(event);

	Engine.PostMessage(this.entity, MT_AttackDetected, { "player": cmpPlayer.GetPlayerID(), "event": event });
	Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface).PushNotification({
		"type": "attack",
		"players": [cmpPlayer.GetPlayerID()],
		"attacker": cmpAttackerOwnership.GetOwner(),
		"targetIsDomesticAnimal": targetIsDomesticAnimal
	});
	PlaySound("attacked", target);
};

AttackDetection.prototype.GetSuppressionTime = function()
{
	return this.suppressionTime;
};

AttackDetection.prototype.HandleTimeout = function()
{
	var cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	var now = cmpTimer.GetTime();
	for (var i = 0; i < this.suppressedList.length; ++i)
	{
		var event = this.suppressedList[i];

		// Check if this event has timed out
		if (now - event.time >= this.suppressionTime)
		{
			this.suppressedList.splice(i, 1);
			return;
		}
	}
};

AttackDetection.prototype.GetIncomingAttacks = function()
{
	return this.suppressedList;
};

// Utility function for calculating the squared-distance between two attack events
function SquaredDistance(pos1, pos2)
{
	var xs = pos2.x - pos1.x;
	var zs = pos2.z - pos1.z;
	return xs*xs + zs*zs;
};

Engine.RegisterComponentType(IID_AttackDetection, "AttackDetection", AttackDetection);
