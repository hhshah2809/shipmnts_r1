const express = require("express");

const app = express();

app.use(express.json());

const PORT = 3000;
let vessels = [];
let hops = [];
let voyages = [];
let containers = [];
let coid = 1;
let cid = 1;
let vid = 1;
let voyageid = 1;
function sendErr(res,status,error,message){
    return res.status(status).json({
        error:error,
        message:message
    });
}

//API 1 
app.post("/vessels",(req,res) => {
    // Handle POST request for creating a new vessel
    try{
    const { name,vessel_number,capacity } = req.body;
    if(!name || !vessel_number || !capacity || capacity==undefined){
        return sendErr(res,400,"VALIDATION_ERROR","name, vessel_number and capacity are required");
    }
    if(!Number.isInteger(capacity) || capacity <= 0){
        return sendErr(res,400,"VALIDATION_ERROR","capacity must be a whole integer greater than 0");
    }
    const existingVessel = vessels.find(v => v.vessel_number === vessel_number);
    if(existingVessel){
        return sendErr(res,409,"VESSEL_ALREADY_EXISTS",`A vessel with number ${vessel_number} already exists`);
    }
    const vessel = {
        id: `c${vid++}`,
        name,
        vessel_number,
        capacity
    };
    vessels.push(vessel);
    return res.status(201).json(vessel);
}
catch(err){
    console.log(err);
    return sendErr(res,500,"INTERNAL_ERROR","Something went wrong please try again");
}

});

//API 2
app.post("/voyages",(req,res)=>{
    const { vessel_id,voyage_number,destination } = req.body;
    if(!vessel_id || !voyage_number || !destination){
        return sendErr(res,400,"VALIDATION_ERROR","vessel_id, voyage_number and destination are required");
    }
    const vessel = vessels.find(v => v.id === vessel_id);
    if(!vessel){
        return sendErr(res,404,"VESSEL_NOT_FOUND","No vessel found with id ${vessel_id}");
    }
    const existingvoyage = voyages.find(v => v.voyage_number === voyage_number);
    if(existingvoyage){
        return sendErr(res,409,"VOYAGE_ALREADY_EXISTS",`A voyage with number ${voyage_number} already exists`);
    }
    const voyage = {
        id : `c${voyageid++}`,
        vessel_id,
        voyage_number,
        destination,
        status:"PLANNED",
        effective_route:[]
    };
    voyages.push(voyage);
    return res.status(201).json(voyage);
});

//API 3
app.post("/voyages/:voyage_id/containers",(req,res)=>{
    let { voyage_id } = req.params;
    const {container_number,destination,due_date,late_charge } = req.body;
    if(!container_number || !destination || !due_date || !late_charge || late_charge==undefined){
        return sendError(res,400,"VALIDATION_ERROR","container_number, destination, due_date and late_charge are required");
    }
    if(late_charge<=0){
        return sendErr(res,400,"VALIDATION_ERROR","late_charge must be greater than 0");
    }
    const target = voyages.find(v => v.id == voyage_id);
    if(!target){
        return sendErr(res,404,"VOYAGE_NOT_FOUND",`No voyage found with id ${voyage_id}`);
    }
    const existingc = containers.find(c => c.container_number === container_number);
    if(existingc){
        return sendErr(res,409,"CONTAINER_ALREADY_EXISTS",`A container with number ${container_number} already exists`);
    }
    if(target.status != "PLANNED"){
        return sendErr(res,409,"VOYAGE_ALREADY_STARTED",`Voyage ${target.voyage_number} has already sailed, containers cannot be added`);
    }
    const targetvessel = vessels.find(v => v.id === target.vessel_id);
    const cnt = containers.filter(c => c.voyage_id===voyage_id).length;
    if(cnt>=targetvessel.capacity){
        return sendErr(res,409,"CAPACITY_EXCEEDED",`${targetvessel.capacity} can carry only 3 containers on one voyage`);
    }
    const newcontainer = {
        id : `c${coid++}`,
        container_number,
        voyage_id,
        destination,
        due_date,
        late_charge,
        arrived_on : null
    };
    containers.push(newcontainer);
    return res.status(201).json(newcontainer);
});

//API 4
let hid = 1;
app.post("/voyages/:voyage_id/hops",(req,res)=>{
    const { voyage_id } = req.params;
    const { from,to,reached_on } = req.body;
    if(!from || !to || !reached_on){
        return sendErr(res,400,"VALIDATION_ERROR","from, to and reached_on are required");
    }
    const tvoyage = voyages.find(v => v.id == voyage_id);
    if(!tvoyage){
        return sendErr(res,404,"VOYAGE_NOT_FOUND",`No voyage found with id ${voyage_id}`);
    }
    if(tvoyage.status == "COMPLETED"){
        return sendErr(res,409,"VOYAGE_COMPLETED",`Voyage ${voyage_id} has already reached its destination ${tvoyage.destination}`);
    }
    const voyagehops = hops.filter(h=> h.voyage_id === voyage_id);
    if(voyagehops.length > 0){
        const lasthop = voyagehops[voyagehops.length - 1];
        if(from != lasthop){
            return sendErr(res,400,"HOP_NOT_CONTIGUOUS",`from must be ${lasthop.to}, the last place this voyage reached`);
        }
    }
    const newhop = {
        id : `h${hid++}`,
        voyage_id,
        from,
        to,
        reached_on
    };
    hops.push(newhop);
    if(to === tvoyage.destination){
        tvoyage.status = 'COMPLETED';
    }
    else{
        tvoyage.status = 'SAILING';
    }
    return res.status(201).json({
        newhop
    });
});

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});