import json
import calendar
from datetime import datetime,date


def date_to_day(date):
   date_object = datetime.strptime(date, '%Y-%m-%d').date()
   x = calendar.day_name[date_object.weekday()]
   return x


with open('chat.json','r', encoding="utf8") as f:
  data = json.load(f)


participants = {} #to count messages per peroson
words_dict = {} #count of word used per person
totalmsgs = len(data['messages'])


num = 0
min_word_lenght = 3 #minmum lenght for most used words


#total count of per persons
char_count_dict = {}
word_count_dict = {}


#word count per person per word
person_word_Dict = {}
person_word_list = []


#total count of messages per hour,date
total_date_dict = {}
total_time_dict = {}


#count of hour,date per person
date_dict = {}
time_dict = {}


#count of day per person
day_dict = {"Monday":{},'Tuesday':{},'Wednesday':{},'Thursday':{},'Friday':{},'Saturday':{},'Sunday':{}}





#main loop
for i in data['messages']:

    #populating Various Dictionarises
    if i['type'] == 'message':
        if i['from'] not in participants:
            participants[i['from']] = 0
            char_count_dict[i['from']] = 0
            word_count_dict[i['from']] = 0
            person_word_Dict[i['from']] = {}
        participants[i['from']] += 1




        if i['date'][0:10] not in total_date_dict:
            total_date_dict[i['date'][0:10]] = 0
            date_dict[i['date'][0:10]] = {}

        if i['from'] not in date_dict[i['date'][0:10]]:
            date_dict[i['date'][0:10]][i['from']] = 0

        total_date_dict[i['date'][0:10]] += 1
        date_dict[i['date'][0:10]][i['from']] +=1





        if i['date'][11:13] not in total_time_dict:
            total_time_dict[i['date'][11:13]] = 0
            time_dict[i['date'][11:13]] = {}

        if i['from'] not in time_dict[i['date'][11:13]]:
            time_dict[i['date'][11:13]][i['from']] = 0

        total_time_dict[i['date'][11:13]] +=1
        time_dict[i['date'][11:13]][i['from']] += 1




        if i['from'] not in day_dict[date_to_day(i['date'][0:10])]:
            day_dict[date_to_day(i['date'][0:10])][i['from']] = 0

        day_dict[date_to_day(i['date'][0:10])][i['from']] +=1




    




    
        
    #Most Used Words
        if type(i['text']) != list:
            for j in i['text'].lower().split():
                if j.lower() not in words_dict and len(j)>min_word_lenght:
                    words_dict[j.lower()] = 0

                if j.lower() not in person_word_Dict[i['from']] and len(j)>min_word_lenght:
                    person_word_Dict[i['from']][j.lower()] = 0

                if len(j.lower())> min_word_lenght:
                    words_dict[j.lower()] += 1
                    person_word_Dict[i['from']][j.lower()] += 1



        #averages
            char_count_dict[i['from']] += len(i['text'].replace(" ", ""))
            word_count_dict[i['from']] += len(i['text'].split())


#sorting dictionaries
mostusedwords = sorted(words_dict.items(), key=lambda x:x[1] ,reverse = True)
mostusedwords = mostusedwords[0:11]

total_date_dict = sorted(total_date_dict.items(), key = lambda x:x[1],reverse=True)

for i in participants:
    dict1 = sorted(person_word_Dict[i].items(),key=lambda x:x[1] , reverse = True)
    dict1 = dict1[0:10]
    person_word_list.append([i,dict1])





#Output of Stats
print("----:TELEGRAM CHAT STATS:----")
print('Total Messages : ',totalmsgs,
    '\nTotal Words : ', sum(word_count_dict.values()),
    '\nTotal Characters : ' , sum(char_count_dict.values()),
    '\nTotal Days Talked : ',len(total_date_dict),
    '\n  ')
print('-'*100,'\n ')





print("-: Most Used Words :-")
for i in mostusedwords[0:10]:
    print(i[0], '-' ,i[1])
print()
print('-'*100,'\n ')




print('--: Averages :--')
print("-: Average Message Length :-")
print(str(sum((char_count_dict.values()))/totalmsgs)[0:4],'Characters')
print(str(sum((word_count_dict.values()))/totalmsgs)[0:4],'Words')
print()


print("-: Averages Per Day :-")
print(str(totalmsgs/len(total_date_dict)),'Messages')
print(str(sum(word_count_dict.values())/len(total_date_dict)),'Words')
print(str(sum(char_count_dict.values())/len(total_date_dict)),'Characters')
print('-'*100,'\n')







print('-: Most Active Dates :-')
for i in total_date_dict:
    print(i[0],':',i[1],'messages')
    for k in date_dict[i[0]]:
        print(k,':',date_dict[i[0]][k])
    print()

    num +=1 
    if num == 5:
        break
print()
print('-'*100,'\n')






print('--: Per Person Stats :--')
print()
print('-:Total Messages:-')
for i in participants:
    print(i,':',participants[i])
print()



print('-: Averages :-')
print('Average Words Per Message')
for i in word_count_dict:
    print(i,':',str((word_count_dict[i]/participants[i]))[0:4])

print()
print('Average Characters Per Message')
for i in char_count_dict:
    print(i,':',str((char_count_dict[i]/participants[i]))[0:4])


print()
print("-: Averages Per Day :-")
print("Messages")
for i in participants:
    print(i,':',participants[i]//len(total_date_dict))
print()
print("Words")
for i in word_count_dict:
    print(i,':',str((word_count_dict[i]//len(total_date_dict))))
print()
print('Characters')
for i in char_count_dict:
    print(i,':',str((char_count_dict[i]//len(total_date_dict))))
    




print()
print('- : Most Used Words : -')
for i in person_word_list:
    print('- ',i[0],' -')
    for j in i[1]:
        print(j[0], ':',j[1])
    print()




print('-'*100,'\n ')
print('-: Hourly Messages Stats :-')
total_time_dict =  sorted(total_time_dict.items())
for i in total_time_dict:
    print(i[0],':',i[1])
    for j in time_dict[i[0]]:
        print(j,time_dict[i[0]][j])
    print()






print('-'*100,'\n ')
print('-: Weekly Messages Stats :-')
for i in day_dict:
    print(i,'-',sum(day_dict[i].values()))
    for j in day_dict[i]:
        print(j,':',day_dict[i][j])
    print()



print('-'*100,'\n ')
print('Made With ❤ By VoiD')
input('Enter any Key To Exit')
exit()


