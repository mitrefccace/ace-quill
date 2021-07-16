import jiwer
import sys, json, numpy as np

#Read data from stdin
def read_in():
    lines = sys.stdin.readlines()
    #Since our input would only be having one line, parse our JSON data from that
    return json.loads(lines[0])

def main():
    lines = read_in()
    # print(lines)

    ground_truth = lines[0]
    hypothesis = lines[1]

    transformation = jiwer.Compose([
        jiwer.RemoveMultipleSpaces(),
        jiwer.Strip(),
        jiwer.RemovePunctuation(),
        jiwer.SentencesToListOfWords(),
        jiwer.RemoveEmptyStrings(),
        jiwer.ToLowerCase(),
    ])

    measures = jiwer.compute_measures(
        ground_truth,
        hypothesis,
        truth_transform=transformation,
        hypothesis_transform=transformation
    )
    wer = measures['wer']
    mer = measures['mer']
    wil = measures['wil']


    print(str(wer)[0:5])
    print(str(mer)[0:5])
    print(str(wil)[0:5])


#start process
if __name__ == '__main__':
    main()

