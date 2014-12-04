/* Wait for Document to Load */
$(document).ready(function() {
    /*Declaring Globals*/
    window.runningJobs = [];
    window.jobRunLimit = 300; /* 5 Minutes execution limit*/
    window.socket = null;
    window.seqFlops = calculateGigaFlopsSequential();
    window.parFlops = 0;
    window.RTT = "temp";

    /* Workers are available, proceed */
    if (areWebWorkersSupported()) {

        /* This flops will be calculate asynchronously and stored in  the
         global variable paFlops */
        calculateGigaFlopsParallel(2);

        /*Show connect Button */
        $(".button-wrap").fadeIn();

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
                if (socket)
                    socket.connect();
                else
                    socketIOConnect();

                /* Change button text */
                $("#btnConnect").html("Leave");
            }
        });

    } /* Workers not supported */
    else {
        /* Show no support message */
        $("#pNotSupported").fadeIn();
    }
});


function socketIOConnect() {

    /* Extracting browser's info */
    var sysInfo = dumpSystemInfo();

    /* Join World Wide Cluster */
    socket = io.connect("https://wwcl-server-mastayoda1.c9.io", {
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
        
        /* Receiving request for RTT */
        socket.on('sampleRTT', function(status) {

            socket.emit("sampleRTTResponse");

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

        /* Creating sandbox and executing */
        var p = new Parallel(code.data, {maxWorkers:8});

        /* If a partitioned job*/
        if (job.jobCode.isPartitioned)
        /* Executing single Job*/
            p.map(code.kernel).then(execJobCallBack);
        else
        /* Executing Multiple threads upon mapped array Job*/
            p.spawn(code.kernel).then(execJobCallBack);

    }
    catch (e) {

        /* Error Ocurred */
        var error = {};
        error.error = e.toString();
        error.clientSocketId = job.clientSocketId;
        sendError(error);
    }
}


/* build kernel and data */
function codeBuilder(job) {

    var params = eval(JSON.parse(job.jobCode.paramsAndData));
    
    if(job.jobCode.isPartitioned)
        var func = eval("a=function(params){result='result variable not set!';try{" + job.jobCode.kernelCode + "}catch(ex){result=ex.toString();}params.result = result;delete params.data;return params;}");
    else
        var func = eval("a=function(params){result='result variable not set!';try{" + job.jobCode.kernelCode + "}catch(ex){result=ex.toString();}params.result = result;return params;}");
    

    /* If a partitioned job, split array and assign data */
    if (job.jobCode.isPartitioned) {
        
        var paramArr = [];
        /* Adding first index */
        var indexCnt = job.jobCode.pRange[0];
        /* Building objects */
        for (var i = 0; i < params.length; i++) {
            var obj = {};
            obj.data = params[i];
            obj.index = indexCnt;
            obj.clientSocketId = job.clientSocketId;
            obj.jobId = job.jobId;
            
            paramArr.push(obj);
            indexCnt++;
        }
        return {
            "kernel": func,
            "data": paramArr
        };

    }
    else {
        
        var obj = {};
        obj.data = params;
        obj.clientSocketId = job.clientSocketId;
        obj.jobId = job.jobId;
        
        return {
            "kernel": func,
            "data": obj
        };
    }
}

function execJobCallBack(execResults) {

    /* if results from kernel function is undefined
     * something went terrible wrong, return */
    if (execResults == undefined) {
        /* Error Ocurred */
        var error = {};
        error.error = "Kernel function returned undefined.";
        error.clientSocketId = "NEED TO FIX THIS";
        sendError(error);
    }
    
    /* If map operation, clean results */
    if(execResults instanceof Array)
    {
        var mapRes = {};
        mapRes.clientSocketId = execResults[0].clientSocketId;
        mapRes.jobId = execResults[0].jobId;
        mapRes.result = [];
        
        for(var i=0;i<execResults.length;i++)
        {
            /* Cleaning unnecesary properties */
            delete execResults[i].clientSocketId;
            /* Pushing data */
            mapRes.result.push(execResults[i]);
        }
        
        /* reseting results */
        execResults = mapRes;
    }
    else /* Spawn instance */
    {
        delete execResults.sandboxSocketId;
        delete execResults.data;
    }
    
    /* returning reesuls */
    sendResults(execResults);
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



function areWebWorkersSupported() {
    return typeof(Worker) !== "undefined";
}

/* Get Object with all system Specifications */
function dumpSystemInfo(address) {
    var specs = {};

    specs.browserInfo = getBrowserInfo();
    specs.platform = getOS();
    specs.publicIP = "24.15.47.225"; //getClientIP();
    specs.uptime = new Date();
    specs.flops = seqFlops;
    specs.pFlops = parFlops;
    specs.isNodeJS = false
    
    specs.RTT = window.RTT;

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

    xmlhttp.open("GET", "http://ip-api.com/json", false);
    xmlhttp.send();

    hostipInfo = xmlhttp.responseText.split("\n");

    return JSON.parse(hostipInfo[0]).query;
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


function calculateGigaFlopsSequential() {

    var bench = numeric.bench;
    var mkA = function(n) {
        return numeric.random([n, n]);
    };
    var mkV = function(n) {
        return numeric.random([n]);
    };
    var V = mkV(3000);
    var V1 = mkV(1000);
    var V2 = mkV(1000);
    var absBench = bench(function() {
        numeric.abs(V);
    });
    //console.log("absBench:" + absBench);
    var identityBench = bench(function() {
        numeric.identity(1000);
    });
    //console.log("identityBench:" + identityBench);
    var A = mkA(1000);
    var matrixTrans = bench(function() {
        numeric.transpose(A);
    });
    // console.log("matrixTrans:" + matrixTrans);
    var matrixVectorProduct = bench(function() {
        numeric.dot(A, V1);
    });
    // console.log("matrixVectorProduct:" + matrixVectorProduct);
    var vectorMatrixProduct = bench(function() {
        numeric.dot(V1, A);
    });
    // console.log("vectorMatrixProduct:" + vectorMatrixProduct);
    var linePlusSlope = bench(function() {
        numeric.addeq(numeric.dot(A, V1), V2);
    });
    //  console.log("linePlusSlope:" + linePlusSlope);
    var A = mkA(100);
    var B = mkA(100);
    var matrixMatrixProduct = bench(function() {
        numeric.dot(A, B);
    });
    //  console.log("matrixMatrixProduct:" + matrixMatrixProduct);
    var matrixMatrixSum = bench(function() {
        numeric.add(A, A);
    });
    //  console.log("matrixMatrixSum:" + matrixMatrixSum);
    var matrixInverse = bench(function() {
        numeric.inv(A);
    });
    //  console.log("matrixInverse:" + matrixInverse);
    var A = numeric.ccsScatter(numeric.cdelsq(numeric.cgrid(30)));
    var sparseLaplacian = bench(function() {
        numeric.ccsLUP(A);
    });
    //   console.log("sparseLaplacian:" + sparseLaplacian);
    var A = numeric.cdelsq(numeric.cgrid(30));
    var bandedLaplacian = bench(function() {
        numeric.cLU(A);
    });
    //  console.log("bandedLaplacian:" + bandedLaplacian);
    var geometricmeans = (absBench + identityBench + matrixTrans + matrixVectorProduct + vectorMatrixProduct + linePlusSlope + matrixMatrixProduct + matrixMatrixSum + matrixInverse + sparseLaplacian + bandedLaplacian) / 11000;

    return Number(geometricmeans.toFixed(2));
}


function calculateGigaFlopsParallel(numOfcores) {

    /* Verifying number of cores */
    if (navigator.hardwareConcurrency)
        numOfcores = navigator.hardwareConcurrency;

    var p = new Parallel(new Array(numOfcores), {
        evalPath: 'js/eval.js'
    });
    p.require('numeric-1.2.6.js');

    p.map(calculateGigaFlopsSequential).then(function(geometricmeans) {

        var mean = 0;
        for (var i = 0; i < geometricmeans.length; i++)
            mean += geometricmeans[i];

        /* Storing parallel flops */
        window.parFlops = Number(mean.toFixed(2));

        /* FOR TESTING REMOVE LATER */
        /* Connect to the system */
        socketIOConnect();
    });

}

/*****************BenchMark Functions******************************************/
function recordRTT(error, stdout, stderr) {
      window.RTT = "TEST";
}