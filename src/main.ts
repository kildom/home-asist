
/* Implement following state machine:

digraph MainStateMachine {

    init [label="init"]
    exit [label="exit"]
    
    init -> waiting
    waiting -> preRecognition [label="[non-final text]"]
    waiting -> recognition [label="[final text]"]
    preRecognition -> recognition [label="[final text]"]
    recognition -> preQuery [label="[timeout 3s]"]
    recognition -> recognition [label="[any text]"]
    preRecognition -> preQuery [label="[timeout 5s]"]
    preRecognition -> preRecognition [label="[non-final text]"]
    preQuery -> query [label="[first response]"]
    query -> waiting [label="[query done]"]
    preQuery -> recognition [label="[query text changed\nand final exists]"]
    preQuery -> preRecognition [label="[query text changed\nand only non-final]"]
    waiting -> exit [label="[timeout 7s]"]

}

*/

