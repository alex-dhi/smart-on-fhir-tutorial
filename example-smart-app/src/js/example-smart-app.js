(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      /*code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }*/
                    }
                  });

        var con_promise = smart.patient.api.fetchAll({
                    type: 'Condition',
                    query: {}
                  });

                  $.when(pt, obv).fail(onError);

        $.when(pt, obv, con_promise).done(function(patient, obv, con_bundle) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var info = {};
          var p = defaultPatient();
          info['p'] = p;
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          // extract conditions
          let con_array = [];
          info['conditions'] = con_array;

          con_bundle.entry.forEach(function(con) {
            let resource = con.resource;
            if (resource && (
              resource.verificationStatus == 'confirmed'
              || resource.verificationStatus == 'differential'
              || resource.verificationStatus == 'refuted'
              )) {
              let con_obj = {};
              con_obj.category = resource.category.text;
              if (resource.code.coding) {
                con_obj.system = resource.code.coding.system;
                con_obj.code = resource.code.coding.code;
                con_obj.display = resource.code.coding.display;
              } else {
                con_obj.display = resource.code.text;
              }

              if (resource.clinicalStatus) {
                con_obj.clinicalStatus = resource.clinicalStatus;
              }
              con_array.push(con_obj);
            }
          });
          ret.resolve(info);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(info) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(info.p.fname);
    $('#lname').html(info.p.lname);
    $('#gender').html(info.p.gender);
    $('#birthdate').html(info.p.birthdate);
    $('#height').html(info.p.height);
    $('#systolicbp').html(info.p.systolicbp);
    $('#diastolicbp').html(info.p.diastolicbp);
    $('#ldl').html(info.p.ldl);
    $('#hdl').html(info.p.hdl);

    // build conditions table
    let tbl_html = "<table><tr><th>Category</th><th>Condition</th><th>Codeset</th><th>Code</th><th>Clinical Status</th></tr>";
    for (let i=0; i < info.conditions.length; i++) {
      let con = info.conditions[i];
      tbl_html += "<tr><td>" + con.category + "</td><td>" + con.display + "</td><td>" 
                  + con.system + "</td><td>" + con.code + "</td><td>" + con.clinicalStatus + "</td></tr>";
    }
    tbl_html += "</table>";
    $('#div-conditions').html(tbl_html);
  };

})(window);
