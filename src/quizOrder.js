export function randomQuiz(quiz = []) {
  const shuffle = items => {
    const copy = [...items]
    for (let i=copy.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]
    }
    return copy
  }
  return shuffle(quiz.map((q,originalIndex)=>{
    const optionOrder=shuffle(q.options.map((_,i)=>i))
    return {...q,originalIndex,optionOrder,options:optionOrder.map(i=>q.options[i]),answer:optionOrder.indexOf(q.answer)}
  }))
}
export function originalAnswers(questions,answers) {
  const result=[]
  questions.forEach((q,i)=>{result[q.originalIndex]=q.optionOrder[answers[i]]})
  return result
}
