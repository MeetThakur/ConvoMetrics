import streamlit as st
import json
from datetime import datetime,date
import calendar
import time

st.set_page_config(
        page_title="Convo Metrics",
)
def date_to_day(date):
   date_object = datetime.strptime(date, '%Y-%m-%d').date()
   x = calendar.day_name[date_object.weekday()]
   return x

st.title('Decode Your Chats: Telegram Insights at Your Fingertips!')
data = st.file_uploader('Upload Your CHat File',type='json')

text = '''Steps to get your chat file:-\n
    1 - Open Telegram app on your PC
    2 - Go to your preferred chat
    3 - Click on three dots on top right corner
    4 - Click on export chat and export it in json format
'''




x = st.write(text) 
if data is not None:
    data = json.load(data)


    participants = {} #to count messages per peroson
    words_dict = {} #count of word used per person
    totalmsgs = len(data['messages'])

    min_word_lenght = 3 #minmum lenght for most used mostUsedWords

    #total count of per persons
    char_count_dict = {}
    word_count_dict = {}

    #word count per person per word
    person_word_Dict = {}
    mostUsedWords = {}

    #count of hour,date per person
    date_dict = {}
    time_dict = {}

    #count of day per person
    day_dict = {}



    #main loop
    for i in data['messages']:

        if i['type'] == 'message':
            if i['from'] not in participants:
                mostUsedWords[i['from']] = {}
                participants[i['from']] = 0
                char_count_dict[i['from']] = 0
                word_count_dict[i['from']] = 0
                person_word_Dict[i['from']] = {}
                day_dict[i['from']] = {"Monday":0,'Tuesday':0,'Wednesday':0,'Thursday':0,'Friday':0,'Saturday':0,'Sunday':0}
                time_dict[i['from']] = {}
                date_dict[i['from']] = {}


            if i['date'][0:10] not in date_dict[i['from']]:
                date_dict[i['from']][i['date'][0:10]] = 0

            if i['date'][11:13] not in time_dict[i['from']]:
                time_dict[i['from']][i['date'][11:13]] = 0

            participants[i['from']] += 1
            date_dict[i['from']][i['date'][0:10]] +=1
            time_dict[i['from']][i['date'][11:13]] += 1
            day_dict[i['from']][date_to_day(i['date'][0:10])] +=1


            if type(i['text']) != list:
                for j in i['text'].lower().split():
                    if j.lower() not in words_dict and len(j)>min_word_lenght:
                        words_dict[j.lower()] = 0

                    if j.lower() not in person_word_Dict[i['from']] and len(j)>min_word_lenght:
                        person_word_Dict[i['from']][j.lower()] = 1

                    if len(j.lower())> min_word_lenght:
                        words_dict[j.lower()] += 1
                        person_word_Dict[i['from']][j.lower()] += 1



            #averages
                char_count_dict[i['from']] += len(i['text'].replace(" ", ""))
                word_count_dict[i['from']] += len(i['text'].split())


    #sorting dictionaries
    words_dict = sorted(words_dict.items(), key=lambda x:x[1] ,reverse = True)
    words_dict = dict(words_dict[0:11])


    mostdays = 0
    for i in date_dict:
        if len(date_dict[i]) > mostdays:
            mostdays = len(date_dict[i])

    for i in participants:
        temp = sorted(person_word_Dict[i].items(),key=lambda x:x[1] , reverse = True)
        temp = dict(temp)
        person_word_Dict[i] = temp


    person_day_dict = {}
    for i in day_dict:
        person_day_dict[i] = sum(day_dict[i].values())



    for i in words_dict:
        for j in mostUsedWords:
            mostUsedWords[j][i] = 0
            if i in person_word_Dict[j]:
                mostUsedWords[j][i] += person_word_Dict[j][i]

    print(mostUsedWords)










    st.header(f'''General Metrics
        Total Messages - {totalmsgs}
    Total Words - {sum(word_count_dict.values())}
    Total Characters - {sum(char_count_dict.values())}
    Total Days Talked - {mostdays}
    Total Participants - {len(participants)}'''   
          )

    col1, col2 , col3 = st.columns(3)

    with col1:
        st.subheader('Total Messages')
        st.bar_chart(participants)
    with col2:
        st.subheader('Total words')
        st.bar_chart(word_count_dict)

    with col3:
        st.subheader('Total Charaters')
        st.bar_chart(char_count_dict)


    st.header('Averages')
    st.subheader(f'''Averages Per Messages
        Words - {str(sum((word_count_dict.values()))/totalmsgs)[0:4]}
    Characters -  {str(sum((char_count_dict.values()))/totalmsgs)[0:5]}''')



    adm = {}
    for i in word_count_dict:
        adm[i]= (word_count_dict[i]/participants[i])

    cdm= {}
    for i in char_count_dict:
        cdm[i]= (char_count_dict[i]/participants[i])


    col1 , col2 = st.columns(2)
    with col1:
        st.subheader('Words')
        st.bar_chart(adm)

    with col2:
        st.subheader('Characters')
        st.bar_chart(cdm)

    st.subheader(f'''Daily Averages
        Messages - {str(totalmsgs/mostdays).split('.')[0]}
    Words - {str(sum((word_count_dict.values()))/mostdays).split('.')[0]}
    Characters - {str(sum(char_count_dict.values())/mostdays).split('.')[0]}
             ''')


    col1,col2,col3 = st.columns(3)

    mdm = {}
    for i in participants:
        mdm[i] = participants[i]/mostdays
    with col1:
        st.subheader('Messages')
        st.bar_chart(mdm)

    wdm = {}
    for i in word_count_dict:
        wdm[i] = word_count_dict[i]/mostdays

    with col2:
        st.subheader('Words')
        st.bar_chart(wdm)   

    cdmm = {}
    for i in char_count_dict:
        cdmm[i] = char_count_dict[i]/mostdays

    with col3:
        st.subheader('Characters')
        st.bar_chart(cdmm)




    st.header('Most Used Words')
    st.bar_chart(mostUsedWords)

    st.header('Date-Wise Stats')
    st.bar_chart(data=date_dict)

    st.header('Weekly Stats')
    st.bar_chart(data=day_dict)

    st.header('Hourly Stats')
    st.bar_chart(data=time_dict)



st.write('Made with ❤️ by Meet')
st.write('Consider Starring 🌟 The repository if you like it')

