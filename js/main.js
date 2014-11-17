/* Wait for Document to Load */
$(document).ready(function() {

    /*Declaring Globals*/
    window.runningJobs = [];
    window.jobRunLimit = 300; /* 5 Minutes execution limit*/
    window.socket = null;

    /* FOR TESTING REMOVE LATER */
    /* Connect to the system */
    socketIOConnect();
    /* Change button text */
    $("#btnConnect").html("Leave");

    /* On connect Event */
    $("#btnConnect").click(function() {

        if ($("#btnConnect").html() == "Leave") {
            /* Connect to the system */
            socket.disconnect();
            /* Change button text */
            $("#btnConnect").html("Join");
        }
        else {
            /* Connect to the system */
            if(socket)
                socket.connect();
            else
                socketIOConnect();
            
            /* Change button text */
            $("#btnConnect").html("Leave");
        }
    });
});


function socketIOConnect() {

    /* Extracting browser's info */
    var sysInfo = dumpSystemInfo();

    /* Join World Wide Cluster */
    socket = io.connect(document.URL, {
        query: 'isClient=' + false + '&' + 'sysInfo=' + JSON.stringify(sysInfo)
    });

    /* Connection succeed */
    socket.on('connect', function() {

        /* Reconnect Event */
        socket.on('reconnect', function() {
            reconnect();
        });

        /* Disconnect handler */
        socket.on('disconnect', function() {

            disconnect();
        });

        /* Requesting Job Execution */
        socket.on('jobExecutionRequest', function(job) {

            jobExecutionRequest(job);
        });

        /* Receiving sandbox count re */
        socket.on('clusterStatusResponse', function(status) {

            clusterStatusResponse(status);

        });

        /* Requestion Cluster Status */
        socket.emit("clusterStatusRequest");

    });

}

/******************** SOCKET EVENTS ************************************/
function reconnect() {


}

function disconnect() {


}

function jobExecutionRequest(job) {

    try {
        /* Parsing the code */
        var code = codeBuilder(job);
        /* Creating references for results (Client Socket reference)*/
        code.data.clientSocketId = job.clientSocketId;
        /* Creating sandbox and executing */
        var p = new Parallel(code.data);

        /* Executing Job */
        p.spawn(code.kernel).then(function(execResults) {

            /* if results from kernel function is undefined
             * something went terrible wrong, return */
            if (execResults == undefined) {
                /* Error Ocurred */
                var error = {};
                error.error = "Kernel function returned undefined.";
                error.clientSocketId = "NEED TO FIX THIS";
                sendError(error);
            }

            /* returning reesuls */
            sendResults(execResults);
        });
    }
    catch (e) {

        /* Error Ocurred */
        var error = {};
        error.error = e.toString();
        error.clientSocketId = job.clientSocketId;
        sendError(error);
    }
}

function clusterStatusResponse(status) {
    console.log(status);

}

/*************************** HELPER FUNCTIONS **********************************/
/* Send Results Back when done */
function sendResults(results) {
    socket.emit("jobDeploymentResponse", results);
}

function sendError(error) {
    socket.emit("jobDeploymentErrorResponse", error);
}


/* build kernel and data */
function codeBuilder(job) {

    var params = eval(JSON.parse(job.jobCode.paramsAndData));
    var func = eval("a=function(params){result='result variable not set!';try{" + job.jobCode.kernelCode + "}catch(ex){result=ex.toString();}params.result = result;return params;}");

    return {
        "kernel": func,
        "data": params
    };
}

/* Get Object with all system Specifications */
function dumpSystemInfo(address) {

    var specs = {};

    specs.browserInfo = getBrowserInfo();
    specs.platform = getOS();
    specs.publicIP = "24.15.47.225"; //getClientIP();
    specs.flops = 1;
    specs.isNodeJS = typeof exports !== 'undefined' && this.exports !== exports;

    return specs;
}

function getOS() {

    if (navigator.appVersion.indexOf("Win") != -1) return "win32";
    if (navigator.appVersion.indexOf("Mac") != -1) return "darwin";
    if (navigator.appVersion.indexOf("Linux") != -1) return "linux";

    return "Unknown";
}

function getClientIP() {

    if (window.XMLHttpRequest) xmlhttp = new XMLHttpRequest();
    else xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");

    xmlhttp.open("GET", "http://api.hostip.info/get_html.php", false);
    xmlhttp.send();

    hostipInfo = xmlhttp.responseText.split("\n");

    for (i = 0; hostipInfo.length >= i; i++) {
        ipAddress = hostipInfo[i].split(":");
        if (ipAddress[0] == "IP") return ipAddress[1];
    }

    return false;
}

function getBrowserInfo() {
    var N = navigator.appName,
        ua = navigator.userAgent,
        tem;
    var M = ua.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);
    if (M && (tem = ua.match(/version\/([\.\d]+)/i)) != null) M[2] = tem[1];
    M = M ? [M[1], M[2]] : [N, navigator.appVersion, '-?'];
    return M;
}