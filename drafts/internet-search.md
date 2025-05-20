
* function: search google
* when called:
  * copy current chat context to temporary context and use it
  * search google
  * ask assistant which of the results are most relevant to the subject (or in simpler mode use first 3 results)
  * roll back temporary context
  * get page
  * convert to md (maybe use firefox to execute scripts and get rendered html)
  * ask assistant to answer to that question using information from that page. Tools are disabled, so only text will be available
    (maybe additional prompt to tell if you cannot do something, write what you want to do and all information about it)
  * if more depth enabled: ask assistant if any link from that page may provide some more information on that subject.
  * roll back temporary context
  * repeat for all selected pages (may be in parallel)
  * ask assistant to answer using information from answers generated for each page.
  * the assistant answer is a return value from "search google" function.