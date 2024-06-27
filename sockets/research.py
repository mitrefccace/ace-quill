#                                  NOTICE
# 
# This (software/technical data) was produced for the U. S. Government under
# Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
# Regulation Clause 52.227-14, Rights in Data-General. No other use other than
# that granted to the U. S. Government, or to those acting on behalf of the U. S.
# Government under that Clause is authorized without the express written
# permission of The MITRE Corporation. For further information, please contact
# The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
# McLean, VA 22102-7539, (703) 983-6000.
# 
#                         ©2024 The MITRE Corporation.


import jiwer
import sys, json, numpy as np

#Read data from stdin
def read_in():
    lines = sys.stdin.readlines()
    #Since our input would only be having one line, parse our JSON data from that
    return json.loads(lines[0])

def main():
    lines = read_in()
    #print(lines)
    parseType = sys.argv[1]

    ground_truth = lines[0]
    hypothesis = lines[1]

    if parseType == 'all':
        transformation = jiwer.Compose([
            jiwer.RemoveMultipleSpaces(),
            jiwer.Strip(),
            jiwer.RemovePunctuation(),
            #jiwer.SentencesToListOfWords(),
            jiwer.RemoveEmptyStrings(),
            jiwer.ToLowerCase(),
            jiwer.ReduceToSingleSentence(),
            jiwer.ReduceToListOfListOfWords()
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
    else:
        transformation = jiwer.Compose([
            jiwer.RemoveMultipleSpaces(),
            jiwer.Strip(),
            jiwer.RemovePunctuation(),
            #jiwer.SentencesToListOfWords(),
            jiwer.RemoveEmptyStrings(),
            jiwer.ToLowerCase(),
            jiwer.ReduceToSingleSentence(),
        ])


        hypothesis = jiwer.Strip()(hypothesis)
        hypothesis = jiwer.RemovePunctuation()(hypothesis)
        hypothesis = jiwer.RemoveEmptyStrings()(hypothesis)
        hypothesis = jiwer.ToLowerCase()(hypothesis)
        hypothesis = hypothesis.split('\n')
        hypothesis = jiwer.RemoveMultipleSpaces()(hypothesis)

        ground_truth = jiwer.Strip()(ground_truth)
        ground_truth = jiwer.RemovePunctuation()(ground_truth)
        ground_truth = jiwer.RemoveEmptyStrings()(ground_truth)
        ground_truth = jiwer.ToLowerCase()(ground_truth)
        ground_truth = ground_truth.split('\n')
        ground_truth = jiwer.RemoveMultipleSpaces()(ground_truth)

        for i in range(len(hypothesis)):
            # print(hypothesis[i])
            measures = jiwer.compute_measures(ground_truth[i], hypothesis[i])
            wer = measures['wer']
            mer = measures['mer']
            wil = measures['wil']
            print(str(wer)[0:5] +" "+ str(mer)[0:5] +" "+ str(wil)[0:5])


#start process
if __name__ == '__main__':
    main()

