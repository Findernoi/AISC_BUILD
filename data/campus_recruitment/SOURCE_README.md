---
license: cc0-1.0
task_categories:
- text-classification
language:
- en
tags:
- education
size_categories:
- 1K<n<10K
---


## Dataset Description
This data set consists of Placement data of students in a XYZ campus. Based on the student's performance data we are classifying his Placement Status.
The students report includes the following information:
* CGPA - The grade of the student in his university
* Internships - The no of internship done by the student before final placement
* Projects - The no of projects done by the student
* Workshops/Certifications - The no of workshops attended and the certifications student had
* AptitudeTestScore - The aptitude score the student attained from the exam
* SoftSkillsRating - The soft skill rating attained by the student
* ExtracurricularActivities - Did the student has some extra curricular activities
* PlacementTraining - Did the student got placement training
* SSC_Marks - The senior secondary school marks scored by the student
* HSC_Marks - The higher secondary school marks scored by the student

* PlacementStatus - The label whether the student is Placed or not

## Usecases
- The data can be used to analyse various features of the data and determine which contributes more for the placement success
- The classification model can be build on top of the data to infer for a new students record the placement probability

# Variants
The same data is also available in a [Text format](https://huggingface.co/datasets/Krooz/Campus_Recruitment_Text) which is useful for finetuning an LLM.

PS: Do give a like if you found the dataset useful :)
