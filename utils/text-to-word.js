/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2024 The MITRE Corporation.
*/

const fs = require("fs");
const { Document, Packer, Header, Paragraph, TextRun, HeadingLevel } = require("docx");

function buildBody(data) {
    body = []
    data.forEach(line => {
        if (line != "-----------------") {
            let [time, ...rest] = line.split(' - ')
            rest = rest.join(' - ')

            let confidence = ''
            let text = ''
            let d = rest.lastIndexOf("(");
            text = rest.slice(0, d);
            confidence = rest.slice(d)

            console.info(time)
            console.info("t:", text)
            console.info("c:", confidence)
            body.push({ time, text, confidence })

        }
    });
    return body
}

function buildHeader(metadata) {
    metadata = metadata.split(', ');
    let header = {
        "title": metadata[0] || "Unknown",
        "source": metadata[2] || "Unknown",
        "uploaded_by": metadata[1] || "Unknown",
        "duration": metadata[3] || "0 seconds",
        "asr_engine": metadata[5] || "Unknown",
        "date": metadata[4] || "1/1/1970 0:00"
    };

    // convert time from seconds to minutes:seconds
    let seconds = parseInt(header.duration.split(" ")[0])
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    header.duration = minutes + ":" + seconds;
    return header;
}

function createDocument(header, body) {
    let bodyText = []

    bodyText.push(new Paragraph({
        children: [],  // Just newline without text
    }))

    body.forEach(line => {
        bodyText.push(new Paragraph({
            children: [
                new TextRun({ text: line.time, bold: true }),
                new TextRun(" - " + line.text),
                new TextRun({ text: line.confidence, bold: true })
            ]
        }))
        bodyText.push(new Paragraph({
            children: [],  // Just newline without text
        }))
    })

    const doc = new Document({
        sections: [
            {
                properties: {},
                headers: {
                    default: new Header({
                        children: [new Paragraph({ text: header.title, bold: true, alignment: "center", heading: HeadingLevel.TITLE, }),
                        new Paragraph({ text: "Source: " + header.source, alignment: "center" }),
                        new Paragraph({ text: "Uploaded by: " + header.uploaded_by, alignment: "center" }),
                        new Paragraph({ text: "ASR Engine: " + header.asr_engine, alignment: "center" }),
                        new Paragraph({ text: "Length: " + header.duration, alignment: "center" }),
                        new Paragraph({ text: header.date, alignment: "center" })
                        ],
                    }),
                },
                children: bodyText
            },
        ],
    });

    return doc;
}
module.exports = {
    buildWordFromFile(file, callback) {
        fs.readFile(file, 'utf8', function (err, data) {
            if (err) throw err;
            lines = data.split(/\r?\n/)
            header = buildHeader(lines[0])
            lines.shift()
            body = buildBody(lines)
            const doc = createDocument(header, body)
            Packer.toBuffer(doc).then((buffer) => {
                callback(buffer)
            });
        });
    }
}