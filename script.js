
console.log('JS Loaded ...');
window.AudioContext = window.AudioContext || window.webkitAudioContext; 

/// Declaring Variables for UI
let dial, noteValue = null; 
let lastNoteValue = null; 


/// Declaring Variables for Audio Context 

let audioContext = null; 
let isPlaying = false; 
let sourceNode = null; 
let analyser = null; 
let theBuffer = null; 
let DEBUGCANVAS = null; 
let mediaStreamSource = null; 

let MAX_SIZE = 0; 

let detectorElem, 
    canvasElem, 
    waveCanvas, 
    pitchElem, 
    noteElem, 
    detuneElem, 
    detuneAmount; 

let compressor, filter = null; 


let rafID = null; 
let tracks = null; 
let buflen = 2048; 
let buf = new Float32Array(buflen);  

// \u266f: Unicode Char for Sharp sign 
// \u266D: Unicode Char for Flat sign

let noteStrings = ["C", "C\u266f", "D", "E\u266D", "E", "F", "F\u266f", "G", "G\u266f", "A", "B\u266D", "B"]; 

window.onload = function() 
{
    audioContext = new AudioContext(); 
    dial = document.querySelector('.dial'); 
    noteValue = document.querySelector('.NoteValue'); 

    //// Creating Audio Context 
    // MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000)); // Corresponds to a 5kHZ signal

    MicInput(); // Initializing the 

};// end window.onload()


function MicInput()
{
   
   
    //// Setting up audio 
    getUserMedia(
        {
            "audio": 
            {
                mandatory: 
                {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                }, 
                "optional": []
            },
        }, goStream); 

    // updatePitch(); 
}// end LiveInput()

////==================================================================================
//// The following codes are copied from PitchDetect, GitHub source. 
//// I gave full credit to author to accomplish my project without using too much research. 
//// If you want to see the original source code, please go to the following link. 
//// Source Code: https://github.com/cwilso/PitchDetect
////==================================================================================

function error() 
{
    alert('Stream generation failed.');
}// end error()

function getUserMedia(dictionary, callback)
{
    try 
    {
        navigator.getUserMedia = navigator.getUserMedia || 
                                    navigator.webkitGetUserMedia || 
                                    navigator.mozGetUserMedia; 

        navigator.getUserMedia(dictionary, callback, error); 

    }
    catch(e)
    {
        alert('getUserMedia threw exception :' + e);
    }// end try - catch()

}// end getUserMedia()

function goStream(stream) 
{
   

    filter = audioContext.createBiquadFilter();
    filter.Q.value = 8.30;
    filter.frequency.value = 440;
    filter.gain.value = 3.0;
    filter.type = filter.LOWPASS;
    filter.frequency.value = 0;

    // filter.connect(compressor);

    //// Create an AudioNode from the stream 
    mediaStreamSource = audioContext.createMediaStreamSource(stream); 

    //// Connect it to the destination 
    analyser = audioContext.createAnalyser(); 
    analyser.fftSize = 2048; 

    // analyser.connect(filter); // For noise cancellation
    // filter.connect(analyser); 
    mediaStreamSource.connect(analyser); 
    // analyser.connect(filter); 
    // mediaStreamSource.connect(filter); 

    console.log(analyser);

    //// Updating Pitch
    updatePitch(); 

}// end goStream()


let isPause = false; 


function updatePitch()
{
    // let cycles = new Array; 
    let getFloatTimeDomainData = analyser.getFloatTimeDomainData(buf); 
    
    
    console.log("====================================================================");


    let ac = autoCorrelate(buf, audioContext.sampleRate);
    ac = ac.toFixed(2); 

    console.log("[ac]", ac);

    //// ac: is accuracy 
    // if (ac != -1) // Can't detect the tune
    if ( ac >= 123.47 && ac <= 3951.07) // Our tuner start to detect from C3 and C8 interval to reduce noise. 
    {
      
        let pitch = ac; 

        //// Getting the pitch 
        // console.log("[Pitch] : ", pitch); 

        //// Getting node value 
        let note = noteFromPitch(pitch); // Getting note from "noteFromPitch()"
        let singleNoteValue = noteStrings[note % 12]; // Getting all 12 nodes from the array

        //// Update only when we receive only new node value 
        if (lastNoteValue !== singleNoteValue)
        {
            DisplayNote(singleNoteValue); 
            lastNoteValue = singleNoteValue; 
        }

        // console.log("[Note] : ", singleNoteValue, " => ", lastNoteValue);

        let detune = centsOffFromPitch(pitch, note); // Getting cents range between -50 to +50

        if (detune == 0)
        {
            console.log('[++] TUNED @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
            DialMoveByDegree(detune * 1.8); 
        }
        else 
        {
            //// TODO: categorizing the Flat and Sharp 
            //// 1.8 is coming from if 50cents scale. Our transform range is at 90 units scale. 
            //// If you scale down 90 to 50 scales interval, we have to do 90/50=1.8
            if (detune < 0)
            {
            //    console.log("[-] flat"); // Flat
               detune += 3; 
               DialMoveByDegree(((detune) * 1.8) ); // To get negative value
               
            }
            else 
            {
            //    console.log("[+] sharp"); // sharp
               detune -= 3; 

               DialMoveByDegree(((detune) * 1.8) ); // To get negative value

            //    DialMoveByDegree(((detune) * 1.8 * -1) ); // To get negative value

            }

            let centsVal = Math.abs(detune); 
            console.log("[centsVal]", centsVal);

        }// end if -> detune


        
    }
    else 
    {
        console.log('[-] Error: Can not detect the tune');

        // Resetting UI 
        DialMoveByDegree(-90); 
        DisplayNote("--"); 


    }// end if 

    // console.log("====================================================================\n");

    
    // //// This is loading - "updatePitch()" forever. 
    // if ( ! window.requestAnimationFrame)
    // {
    //     window.requestAnimationFrame = window.webkitRequestAnimationFrame; 
    // }// end if 

    // rafID = window.requestAnimationFrame(updatePitch); 
}// end updatePitch()


setInterval(() => 
{
    updatePitch(); 
}, 1000/2); 


function autoCorrelate(buf, sampleRate)
{
	// Implements the ACF2+ algorithm
    let SIZE = buf.length; 
    let rms = 0; 

    for (let i = 0; i < SIZE; i++)
    {
        let val = buf[i]; 
        rms += val * val; 
    }// end for 

    rms = Math.sqrt(rms / SIZE); 

    if (rms < 0.01) // not enough signal
		return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2; // What is "r" variable 

    for (let i = 0; i < SIZE / 2; i++)
    {
        if (Math.abs(buf[i]) < thres)
        {
            r1 = i; 
            break; 
        }
    }// end for 

    for (let i = 1; i < SIZE / 2; i++)
    {
        if (Math.abs(buf[SIZE - i]) < thres)
        {
            r2 = SIZE - i; 
            break; 
        }
    }// end for 

    buf = buf.slice(r1, r2); 
    SIZE = buf.length; 

    let c = new Array(SIZE).fill(0); 

    for (let i = 0; i < SIZE; i++)
    {
        for (let j = 0; j < SIZE - i; j++)
        {
            c[i] = c[i] + buf[j] * buf[j + i]; 
        }// end for 
    }// end for 

    let d = 0; 

    while (c[d] > c[d + 1]) d++; // end while 

    let maxval = -1, maxpos = -1; 

    for (let i = d; i < SIZE; i++)
    {
        if (c[i] > maxval)
        {
            maxval = c[i]; 
            maxpos = i; 
        }// end if
    }// end for 

    var T0 = maxpos; 

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]; 
    let a = (x1 + x3 - 2 * x2) / 2; 
    let b = (x3 - x1) / 2; 

    if (a)
    {
        T0 = T0 - b / (2 * a); 
    }// end if 


    return sampleRate / T0; 

}// end autoCorrelate()

function noteFromPitch(frequency) // Have seen this on "WebAduio Course on FutureLearn"
{
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)); 

    return Math.round(noteNum) + 69; 
}// end noteFromPitch()


function frequencyFromNoteNumber(note)
{
    return 440 * Math.pow(2, (note - 69) / 12); 
}// end frequencyFromNoteNumber()

//// 
//// Not getting the cents values between -50 and +50 yet. 
//// 
//// 
function centsOffFromPitch(frequency, note)
{
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2)); 
}


function DialMoveByDegree(degree)
{
    dial.style.transform = `rotate(${degree}deg)`; 
    // dial.style.transitionDelay = `0.0375s`; 

}// end DialMoveByDegree()

function DisplayNote(noteVal)
{
    noteValue.innerHTML = noteVal; // Displaying Note on UI
}


